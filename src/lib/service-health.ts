// src/lib/service-health.ts
// Service health monitoring and degraded mode management

import { networkManager, NetworkError, isNetworkError } from './network-utils';
import { NETWORK_CONFIG, FEATURE_FLAGS, type ServiceConfig } from './network-config';

export interface ServiceStatus {
  name: string;
  isHealthy: boolean;
  lastHealthCheck: Date;
  lastSuccess?: Date;
  lastFailure?: Date;
  responseTime?: number;
  errorCount: number;
  uptime: number; // percentage
  isDegraded: boolean;
  capabilities: string[];
  fallbackMode?: 'cache' | 'mock' | 'disabled';
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ServiceStatus>;
  overall: {
    healthyServices: number;
    totalServices: number;
    systemStatus: 'operational' | 'degraded' | 'down';
    lastCheck: Date;
  };
}

export class ServiceHealthMonitor {
  private static instance: ServiceHealthMonitor;
  private serviceStatuses = new Map<string, ServiceStatus>();
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  private isMonitoring = false;

  static getInstance(): ServiceHealthMonitor {
    if (!ServiceHealthMonitor.instance) {
      ServiceHealthMonitor.instance = new ServiceHealthMonitor();
    }
    return ServiceHealthMonitor.instance;
  }

  private constructor() {
    this.initializeServiceStatuses();
  }

  /**
   * Start monitoring all configured services
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    console.log('🏥 [HEALTH] Starting service health monitoring...');
    this.isMonitoring = true;

    // Start health checks for each service
    Object.entries(NETWORK_CONFIG.services).forEach(([serviceName, config]) => {
      this.startServiceHealthCheck(serviceName, config);
    });

    console.log(`✅ [HEALTH] Monitoring ${Object.keys(NETWORK_CONFIG.services).length} services`);
  }

  /**
   * Stop all health monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    console.log('🛑 [HEALTH] Stopping service health monitoring...');
    
    this.healthCheckIntervals.forEach((interval, serviceName) => {
      clearInterval(interval);
      console.log(`   Stopped monitoring ${serviceName}`);
    });
    
    this.healthCheckIntervals.clear();
    this.isMonitoring = false;
  }

  /**
   * Get current health status for all services
   */
  async getHealthStatus(): Promise<HealthCheckResult> {
    const services: Record<string, ServiceStatus> = {};
    let healthyCount = 0;
    const totalCount = this.serviceStatuses.size;

    // Perform immediate health checks
    for (const [serviceName, status] of this.serviceStatuses) {
      try {
        const isHealthy = await this.checkServiceHealth(serviceName);
        const updatedStatus = {
          ...status,
          isHealthy,
          lastHealthCheck: new Date(),
          ...(isHealthy && { lastSuccess: new Date() }),
        };

        this.serviceStatuses.set(serviceName, updatedStatus);
        services[serviceName] = updatedStatus;

        if (isHealthy) healthyCount++;
      } catch (error) {
        const updatedStatus = {
          ...status,
          isHealthy: false,
          lastHealthCheck: new Date(),
          lastFailure: new Date(),
          errorCount: status.errorCount + 1,
        };

        this.serviceStatuses.set(serviceName, updatedStatus);
        services[serviceName] = updatedStatus;
      }
    }

    // Determine overall system status
    let systemStatus: 'operational' | 'degraded' | 'down';
    if (healthyCount === totalCount) {
      systemStatus = 'operational';
    } else if (healthyCount > 0) {
      systemStatus = 'degraded';
    } else {
      systemStatus = 'down';
    }

    return {
      status: systemStatus === 'operational' ? 'healthy' : systemStatus === 'degraded' ? 'degraded' : 'unhealthy',
      services,
      overall: {
        healthyServices: healthyCount,
        totalServices: totalCount,
        systemStatus,
        lastCheck: new Date(),
      },
    };
  }

  /**
   * Get status for a specific service
   */
  getServiceStatus(serviceName: string): ServiceStatus | null {
    return this.serviceStatuses.get(serviceName) || null;
  }

  /**
   * Check if a service is currently healthy
   */
  isServiceHealthy(serviceName: string): boolean {
    const status = this.serviceStatuses.get(serviceName);
    return status?.isHealthy || false;
  }

  /**
   * Enable degraded mode for a service
   */
  enableDegradedMode(serviceName: string, fallbackMode: 'cache' | 'mock' | 'disabled' = 'cache'): void {
    const status = this.serviceStatuses.get(serviceName);
    if (status) {
      status.isDegraded = true;
      status.fallbackMode = fallbackMode;
      this.serviceStatuses.set(serviceName, status);
      
      console.warn(`⚠️ [HEALTH] Service ${serviceName} entering degraded mode (${fallbackMode})`);
    }
  }

  /**
   * Disable degraded mode for a service
   */
  disableDegradedMode(serviceName: string): void {
    const status = this.serviceStatuses.get(serviceName);
    if (status) {
      status.isDegraded = false;
      status.fallbackMode = undefined;
      this.serviceStatuses.set(serviceName, status);
      
      console.log(`✅ [HEALTH] Service ${serviceName} restored to normal mode`);
    }
  }

  /**
   * Get services currently in degraded mode
   */
  getDegradedServices(): string[] {
    const degradedServices: string[] = [];
    this.serviceStatuses.forEach((status, serviceName) => {
      if (status.isDegraded) {
        degradedServices.push(serviceName);
      }
    });
    return degradedServices;
  }

  /**
   * Force a health check for a specific service
   */
  async forceHealthCheck(serviceName: string): Promise<boolean> {
    try {
      const isHealthy = await this.checkServiceHealth(serviceName);
      const status = this.serviceStatuses.get(serviceName);
      
      if (status) {
        status.isHealthy = isHealthy;
        status.lastHealthCheck = new Date();
        
        if (isHealthy) {
          status.lastSuccess = new Date();
          if (status.isDegraded) {
            this.disableDegradedMode(serviceName);
          }
        } else {
          status.lastFailure = new Date();
          status.errorCount++;
          if (!status.isDegraded && FEATURE_FLAGS.gracefulDegradation) {
            this.enableDegradedMode(serviceName);
          }
        }
        
        this.serviceStatuses.set(serviceName, status);
      }
      
      return isHealthy;
    } catch (error) {
      console.error(`❌ [HEALTH] Force health check failed for ${serviceName}:`, error);
      return false;
    }
  }

  // ========== Private Methods ==========

  private initializeServiceStatuses(): void {
    Object.entries(NETWORK_CONFIG.services).forEach(([serviceName, config]) => {
      this.serviceStatuses.set(serviceName, {
        name: serviceName,
        isHealthy: true, // Assume healthy initially
        lastHealthCheck: new Date(),
        errorCount: 0,
        uptime: 100,
        isDegraded: false,
        capabilities: this.getServiceCapabilities(serviceName),
      });
    });
  }

  private startServiceHealthCheck(serviceName: string, config: ServiceConfig): void {
    // Perform initial health check
    this.checkServiceHealth(serviceName);

    // Set up periodic health checks
    const interval = setInterval(async () => {
      await this.performPeriodicHealthCheck(serviceName);
    }, config.healthCheckInterval);

    this.healthCheckIntervals.set(serviceName, interval);
    console.log(`🏥 [HEALTH] Started monitoring ${serviceName} (interval: ${config.healthCheckInterval}ms)`);
  }

  private async performPeriodicHealthCheck(serviceName: string): Promise<void> {
    try {
      const startTime = Date.now();
      const isHealthy = await this.checkServiceHealth(serviceName);
      const responseTime = Date.now() - startTime;

      const status = this.serviceStatuses.get(serviceName);
      if (status) {
        const wasHealthy = status.isHealthy;
        
        status.isHealthy = isHealthy;
        status.lastHealthCheck = new Date();
        status.responseTime = responseTime;

        if (isHealthy) {
          status.lastSuccess = new Date();
          
          // If service recovered, disable degraded mode
          if (!wasHealthy && status.isDegraded) {
            this.disableDegradedMode(serviceName);
          }
        } else {
          status.lastFailure = new Date();
          status.errorCount++;
          
          // Enable degraded mode if not already enabled
          if (wasHealthy && !status.isDegraded && FEATURE_FLAGS.gracefulDegradation) {
            this.enableDegradedMode(serviceName);
          }
        }

        // Update uptime calculation
        status.uptime = this.calculateUptime(status);
        
        this.serviceStatuses.set(serviceName, status);

        // Log status changes
        if (wasHealthy !== isHealthy) {
          const emoji = isHealthy ? '✅' : '❌';
          console.log(`${emoji} [HEALTH] ${serviceName} status changed: ${wasHealthy ? 'healthy' : 'unhealthy'} → ${isHealthy ? 'healthy' : 'unhealthy'}`);
        }
      }
    } catch (error) {
      console.error(`❌ [HEALTH] Health check error for ${serviceName}:`, error);
      this.handleHealthCheckError(serviceName, error);
    }
  }

  private async checkServiceHealth(serviceName: string): Promise<boolean> {
    const config = NETWORK_CONFIG.services[serviceName as keyof typeof NETWORK_CONFIG.services];
    if (!config) {
      // For services without explicit endpoints, return true (assume healthy)
      // This fixes coinbase and blockchain services that don't need URL health checks
      console.log(`🏥 [HEALTH] ${serviceName} has no endpoints configured, assuming healthy`);
      return true;
    }

    if (config.endpoints.length === 0) {
      // Services like coinbase (AgentKit) and blockchain (RPC) might not have explicit health endpoints
      // but are considered healthy if they can be initialized
      return true;
    }

    // Try primary endpoint first
    const primaryEndpoint = config.endpoints[0];
    
    try {
      // Use a simple HEAD request for health check
      const isHealthy = await networkManager.healthCheck(primaryEndpoint.url);
      return isHealthy;
    } catch (error) {
      // If primary fails, try fallback endpoints
      for (let i = 1; i < config.endpoints.length; i++) {
        try {
          const fallbackHealthy = await networkManager.healthCheck(config.endpoints[i].url);
          if (fallbackHealthy) {
            console.log(`🔄 [HEALTH] ${serviceName} primary endpoint failed, but fallback is healthy`);
            return true;
          }
        } catch (fallbackError) {
          // Continue to next fallback
        }
      }

      // For development, be more lenient with health checks
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️ [HEALTH] ${serviceName} health check failed, but allowing in development mode`);
        return true;
      }
      
      return false;
    }
  }

  private handleHealthCheckError(serviceName: string, error: unknown): void {
    const status = this.serviceStatuses.get(serviceName);
    if (status) {
      status.isHealthy = false;
      status.lastFailure = new Date();
      status.errorCount++;
      
      if (!status.isDegraded && FEATURE_FLAGS.gracefulDegradation) {
        this.enableDegradedMode(serviceName);
      }
      
      this.serviceStatuses.set(serviceName, status);
    }
  }

  private calculateUptime(status: ServiceStatus): number {
    // Simple uptime calculation based on recent success rate
    // This could be enhanced with more sophisticated tracking
    const totalChecks = status.errorCount + (status.lastSuccess ? 1 : 0);
    if (totalChecks === 0) return 100;
    
    const successfulChecks = totalChecks - status.errorCount;
    return Math.max(0, Math.min(100, (successfulChecks / totalChecks) * 100));
  }

  private getServiceCapabilities(serviceName: string): string[] {
    switch (serviceName) {
      case 'coinbase':
        return ['wallet', 'balance', 'transactions', 'smart-contracts'];
      case 'xmtp':
        return ['messaging', 'encryption', 'group-chat'];
      case 'blockchain':
        return ['rpc', 'contract-calls', 'transaction-simulation'];
      default:
        return ['basic'];
    }
  }
}

// Export singleton instance
export const serviceHealthMonitor = ServiceHealthMonitor.getInstance();

// Helper functions for graceful degradation
export function canUseService(serviceName: string): boolean {
  if (!FEATURE_FLAGS.gracefulDegradation) return true;
    
  // In development mode with lenient health checks, always allow service usage
  if (FEATURE_FLAGS.lenientHealthChecks) {
    console.log(`🛠️ [HEALTH] Service ${serviceName} allowed in lenient development mode`);
    return true;
  }
  
  return serviceHealthMonitor.isServiceHealthy(serviceName);
}

export function shouldUseFallback(serviceName: string): boolean {
  if (!FEATURE_FLAGS.gracefulDegradation) return false;

  // In lenient development mode, don't use fallbacks
  if (FEATURE_FLAGS.lenientHealthChecks) return false;
  
  const status = serviceHealthMonitor.getServiceStatus(serviceName);
  return status?.isDegraded || false;
}

export function getFallbackMode(serviceName: string): 'cache' | 'mock' | 'disabled' | undefined {
  const status = serviceHealthMonitor.getServiceStatus(serviceName);
  return status?.fallbackMode;
}