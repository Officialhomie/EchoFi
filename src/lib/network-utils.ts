// src/lib/network-utils.ts
// Comprehensive network utility with retry logic, circuit breaker, and caching

import { NETWORK_CONFIG, FEATURE_FLAGS, NETWORK_ERROR_CODES, type NetworkErrorCode, type ServiceConfig } from './network-config';

export interface CircuitBreakerState {
  failures: number;
  lastFailure: Date;
  isOpen: boolean;
  halfOpenExpiry?: Date;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: Date;
  ttl: number;
}

export interface NetworkMetrics {
  requests: number;
  successes: number;
  failures: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
  errorsByType: Record<string, number>;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class NetworkError extends Error {
  public readonly code: NetworkErrorCode;
  public readonly service?: string;
  public readonly url?: string;
  public readonly retryAfter?: number;

  constructor(message: string, code: NetworkErrorCode, service?: string, url?: string, retryAfter?: number) {
    super(message);
    this.name = 'NetworkError';
    this.code = code;
    this.service = service;
    this.url = url;
    this.retryAfter = retryAfter;
  }
}

/**
 * Enhanced NetworkManager with circuit breaker, caching, and comprehensive error handling
 */
export class NetworkManager {
  private static instance: NetworkManager;
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private cache = new Map<string, CacheEntry>();
  private metrics = new Map<string, NetworkMetrics>();
  private requestQueue = new Map<string, number>();
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private constructor() {
    // Start health checks for configured services
    if (FEATURE_FLAGS.enableHealthChecks) {
      this.startHealthChecks();
    }

    // Clean up cache periodically
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }

  /**
   * Main fetch method with retry logic, circuit breaker, and caching
   */
  async fetchWithRetry<T = any>(
    url: string,
    options: RequestInit = {},
    config?: Partial<ServiceConfig & { cacheKey?: string; cacheTtl?: number }>
  ): Promise<T> {
    const serviceConfig = this.getEffectiveConfig(config);
    const cacheKey = config?.cacheKey || this.generateCacheKey(url, options);
    
    // Check cache first
    if (FEATURE_FLAGS.enableRequestCaching && options.method !== 'POST') {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        console.log(`🎯 [NETWORK] Cache hit for ${url}`);
        return cached;
      }
    }

    // Check circuit breaker
    if (FEATURE_FLAGS.enableCircuitBreaker && this.isCircuitBreakerOpen(url)) {
      throw new NetworkError(
        'Service temporarily unavailable (circuit breaker open)',
        NETWORK_ERROR_CODES.CIRCUIT_BREAKER_OPEN,
        serviceConfig.name,
        url,
        30000 // 30 seconds retry after
      );
    }

    // Check rate limiting
    if (!this.canMakeRequest(url, serviceConfig)) {
      throw new NetworkError(
        'Rate limit exceeded',
        NETWORK_ERROR_CODES.RATE_LIMITED,
        serviceConfig.name,
        url,
        60000 // 1 minute retry after
      );
    }

    let lastError: Error | null = null;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= serviceConfig.retries; attempt++) {
      try {
        // Add timeout to request
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), serviceConfig.timeout);

        const requestOptions: RequestInit = {
          ...options,
          signal: timeoutController.signal,
          headers: {
            'User-Agent': 'EchoFi/1.0',
            'Accept': 'application/json',
            ...options.headers,
          },
        };

        console.log(`🔄 [NETWORK] Attempt ${attempt + 1}/${serviceConfig.retries + 1} for ${url}`);

        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        // Record success metrics
        this.recordSuccess(url, Date.now() - startTime);

        // Handle HTTP error status codes
        if (!response.ok) {
          const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          
          if (response.status >= 500) {
            // Server error - retry
            throw new Error(`Server error: ${errorMessage}`);
          } else if (response.status === 429) {
            // Rate limited
            const retryAfter = response.headers.get('Retry-After');
            throw new NetworkError(
              'Rate limited',
              NETWORK_ERROR_CODES.RATE_LIMITED,
              serviceConfig.name,
              url,
              retryAfter ? parseInt(retryAfter) * 1000 : 60000
            );
          } else {
            // Client error - don't retry
            throw new NetworkError(
              errorMessage,
              NETWORK_ERROR_CODES.INVALID_RESPONSE,
              serviceConfig.name,
              url
            );
          }
        }

        // Parse response
        let data: T;
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text() as unknown as T;
        }

        // Cache successful responses
        if (FEATURE_FLAGS.enableRequestCaching && options.method !== 'POST') {
          this.setCache(cacheKey, data, config?.cacheTtl || serviceConfig.cacheTtl || 30000);
        }

        console.log(`✅ [NETWORK] Success for ${url} in ${Date.now() - startTime}ms`);
        return data;

      } catch (error) {
        console.error(`❌ [NETWORK] Attempt ${attempt + 1} failed for ${url}:`, error);
        
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Record failure metrics
        this.recordFailure(url, lastError);

        // Don't retry on final attempt
        if (attempt === serviceConfig.retries) {
          break;
        }

        // Don't retry certain error types
        if (error instanceof NetworkError && 
            (error.code === NETWORK_ERROR_CODES.RATE_LIMITED || 
             error.code === NETWORK_ERROR_CODES.INVALID_RESPONSE)) {
          break;
        }

        // Wait before retrying with exponential backoff
        if (attempt < serviceConfig.retries) {
          const delay = this.calculateBackoffDelay(attempt, serviceConfig.retryDelay);
          console.log(`⏳ [NETWORK] Waiting ${delay}ms before retry...`);
          await this.delay(delay);
        }
      }
    }

    // All retries exhausted
    const errorMessage = `Request failed after ${serviceConfig.retries + 1} attempts: ${lastError?.message || 'Unknown error'}`;
    throw new NetworkError(
      errorMessage,
      NETWORK_ERROR_CODES.MAX_RETRIES_EXCEEDED,
      serviceConfig.name,
      url
    );
  }

  /**
   * Simplified method for quick requests with default config
   */
  async fetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    return this.fetchWithRetry<T>(url, options);
  }

  /**
   * POST request helper
   */
  async post<T = any>(url: string, data: any, options: RequestInit = {}): Promise<T> {
    return this.fetchWithRetry<T>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });
  }

  /**
   * GET request helper with caching
   */
  async get<T = any>(url: string, options: RequestInit = {}, cacheKey?: string): Promise<T> {
    return this.fetchWithRetry<T>(url, {
      method: 'GET',
      ...options,
    }, { cacheKey });
  }

  /**
   * Check if a service is healthy
   */
  async healthCheck(url: string): Promise<boolean> {
    try {
      const response = await this.fetchWithRetry(url, 
        { method: 'HEAD' }, 
        { retries: 1, timeout: 5000 }
      );
      return true;
    } catch (error) {
      console.warn(`🏥 [NETWORK] Health check failed for ${url}:`, error);
      return false;
    }
  }

  /**
   * Get service metrics
   */
  getMetrics(service?: string): NetworkMetrics | Record<string, NetworkMetrics> {
    if (service) {
      return this.metrics.get(service) || {
        requests: 0,
        successes: 0,
        failures: 0,
        averageResponseTime: 0,
        errorsByType: {},
      };
    }
    
    const allMetrics: Record<string, NetworkMetrics> = {};
    this.metrics.forEach((metrics, serviceName) => {
      allMetrics[serviceName] = metrics;
    });
    return allMetrics;
  }

  /**
   * Reset circuit breaker for a service
   */
  resetCircuitBreaker(url: string): void {
    this.circuitBreakers.delete(url);
    console.log(`🔄 [NETWORK] Circuit breaker reset for ${url}`);
  }

  /**
   * Clear cache for specific key or all cache
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
    console.log(`🗑️ [NETWORK] Cache cleared${key ? ` for ${key}` : ' (all)'}`);
  }

  // ========== Private Methods ==========

  private getEffectiveConfig(config?: Partial<ServiceConfig>): ServiceConfig {
    return {
      name: 'default',
      endpoints: [],
      timeout: NETWORK_CONFIG.global.defaultTimeout,
      retries: NETWORK_CONFIG.global.defaultRetries,
      retryDelay: NETWORK_CONFIG.global.defaultRetryDelay,
      circuitBreakerThreshold: 5,
      healthCheckInterval: 60000,
      cacheTtl: 30000,
      ...config,
    };
  }

  private isCircuitBreakerOpen(url: string): boolean {
    const breaker = this.circuitBreakers.get(url);
    if (!breaker) return false;

    if (breaker.isOpen) {
      // Check if half-open period has passed
      if (breaker.halfOpenExpiry && new Date() > breaker.halfOpenExpiry) {
        breaker.isOpen = false;
        breaker.halfOpenExpiry = undefined;
        console.log(`🔄 [NETWORK] Circuit breaker half-open for ${url}`);
        return false;
      }
      return true;
    }

    return false;
  }

  private canMakeRequest(url: string, config: ServiceConfig): boolean {
    const now = Date.now();
    const key = `${url}:${Math.floor(now / 60000)}`; // Per minute window
    const count = this.requestQueue.get(key) || 0;
    
    // Simple rate limiting (could be enhanced with sliding window)
    const maxRequestsPerMinute = 100; // Default, could be configurable
    
    if (count >= maxRequestsPerMinute) {
      return false;
    }
    
    this.requestQueue.set(key, count + 1);
    return true;
  }

  private recordSuccess(url: string, responseTime: number): void {
    // Reset circuit breaker on success
    const breaker = this.circuitBreakers.get(url);
    if (breaker) {
      breaker.failures = 0;
      breaker.isOpen = false;
      breaker.halfOpenExpiry = undefined;
    }

    // Update metrics
    this.updateMetrics(url, true, responseTime);
  }

  private recordFailure(url: string, error: Error): void {
    // Update circuit breaker
    if (FEATURE_FLAGS.enableCircuitBreaker) {
      const breaker = this.circuitBreakers.get(url) || {
        failures: 0,
        lastFailure: new Date(),
        isOpen: false,
      };

      breaker.failures++;
      breaker.lastFailure = new Date();

      const threshold = this.getServiceConfigForUrl(url)?.circuitBreakerThreshold || 5;
      
      if (breaker.failures >= threshold) {
        breaker.isOpen = true;
        breaker.halfOpenExpiry = new Date(Date.now() + 30000); // 30 seconds
        console.warn(`🚨 [NETWORK] Circuit breaker opened for ${url} after ${breaker.failures} failures`);
      }

      this.circuitBreakers.set(url, breaker);
    }

    // Update metrics
    this.updateMetrics(url, false, 0, error);
  }

  private updateMetrics(url: string, success: boolean, responseTime: number, error?: Error): void {
    if (!FEATURE_FLAGS.enableMetrics) return;

    const metrics = this.metrics.get(url) || {
      requests: 0,
      successes: 0,
      failures: 0,
      averageResponseTime: 0,
      errorsByType: {},
    };

    metrics.requests++;
    metrics.lastRequestTime = new Date();

    if (success) {
      metrics.successes++;
      // Update average response time
      metrics.averageResponseTime = (
        (metrics.averageResponseTime * (metrics.successes - 1) + responseTime) / 
        metrics.successes
      );
    } else {
      metrics.failures++;
      if (error) {
        const errorType = error.name || 'UnknownError';
        metrics.errorsByType[errorType] = (metrics.errorsByType[errorType] || 0) + 1;
      }
    }

    this.metrics.set(url, metrics);
  }

  private getServiceConfigForUrl(url: string): ServiceConfig | undefined {
    // Find which service this URL belongs to
    for (const service of Object.values(NETWORK_CONFIG.services)) {
      if (service.endpoints.some(endpoint => url.includes(endpoint.url))) {
        return service;
      }
    }
    return undefined;
  }

  private calculateBackoffDelay(attempt: number, baseDelay: number): number {
    const backoffMultiplier = 2;
    const maxDelay = 10000; // 10 seconds max
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    
    const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
    return delay + jitter;
  }

  private generateCacheKey(url: string, options: RequestInit): string {
    const method = options.method || 'GET';
    const headers = JSON.stringify(options.headers || {});
    const body = options.body || '';
    return `${method}:${url}:${btoa(headers + body)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp.getTime() > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: new Date(),
      ttl,
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp.getTime() > entry.ttl) {
        this.cache.delete(key);
      }
    }

    // Cleanup request queue
    const currentMinute = Math.floor(now / 60000);
    for (const key of this.requestQueue.keys()) {
      const keyMinute = parseInt(key.split(':')[1]);
      if (currentMinute - keyMinute > 5) { // Keep last 5 minutes
        this.requestQueue.delete(key);
      }
    }
  }

  private startHealthChecks(): void {
    // Health check for primary services
    const services = ['coinbase', 'xmtp', 'blockchain'] as const;
    
    services.forEach(serviceName => {
      const service = NETWORK_CONFIG.services[serviceName];
      if (service.endpoints.length > 0) {
        const interval = setInterval(async () => {
          for (const endpoint of service.endpoints) {
            await this.healthCheck(endpoint.url);
          }
        }, service.healthCheckInterval);
        
        this.healthCheckIntervals.set(serviceName, interval);
      }
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Clear health check intervals
    this.healthCheckIntervals.forEach(interval => clearInterval(interval));
    this.healthCheckIntervals.clear();
    
    // Clear caches
    this.cache.clear();
    this.requestQueue.clear();
    this.circuitBreakers.clear();
    this.metrics.clear();
  }
}

// Export singleton instance
export const networkManager = NetworkManager.getInstance();

// Helper functions
export function createNetworkError(message: string, code: NetworkErrorCode, service?: string): NetworkError {
  return new NetworkError(message, code, service);
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function getNetworkErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return `[${error.code}] ${error.message}${error.service ? ` (${error.service})` : ''}`;
  }
  return error instanceof Error ? error.message : String(error);
}