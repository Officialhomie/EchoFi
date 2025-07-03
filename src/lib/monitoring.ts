// src/lib/monitoring.ts
// Comprehensive monitoring and metrics collection system

import { networkManager } from './network-utils';
import { serviceHealthMonitor } from './service-health';
import { cacheManager } from './cache-manager';
import { FEATURE_FLAGS } from './network-config';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface ErrorMetric {
  error: string;
  count: number;
  lastOccurrence: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  service?: string;
}

export interface SystemMetrics {
  performance: PerformanceMetric[];
  errors: ErrorMetric[];
  services: Record<string, any>;
  cache: any;
  network: any;
  uptime: number;
  timestamp: Date;
}

export interface AlertConfig {
  name: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: (metrics: SystemMetrics) => string;
  cooldown: number; // Minimum time between alerts in ms
}

/**
 * Comprehensive monitoring system
 */
export class MonitoringSystem {
  private static instance: MonitoringSystem;
  private metrics = new Map<string, PerformanceMetric[]>();
  private errors = new Map<string, ErrorMetric>();
  private alerts: AlertConfig[] = [];
  private alertCooldowns = new Map<string, Date>();
  private isRunning = false;
  private metricsInterval: NodeJS.Timeout | null = null;
  private alertInterval: NodeJS.Timeout | null = null;
  private startTime = new Date();

  static getInstance(): MonitoringSystem {
    if (!MonitoringSystem.instance) {
      MonitoringSystem.instance = new MonitoringSystem();
    }
    return MonitoringSystem.instance;
  }

  private constructor() {
    this.setupDefaultAlerts();
  }

  /**
   * Start monitoring system
   */
  start(): void {
    if (this.isRunning || !FEATURE_FLAGS.enableMetrics) return;

    console.log('📊 [MONITORING] Starting monitoring system...');
    this.isRunning = true;

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds

    // Start alert checking
    this.alertInterval = setInterval(() => {
      this.checkAlerts();
    }, 60000); // Every minute

    // Initial metrics collection
    this.collectSystemMetrics();

    console.log('✅ [MONITORING] Monitoring system started');
  }

  /**
   * Stop monitoring system
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('🛑 [MONITORING] Stopping monitoring system...');
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = null;
    }

    this.isRunning = false;
    console.log('✅ [MONITORING] Monitoring system stopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    if (!FEATURE_FLAGS.enableMetrics) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    };

    const existing = this.metrics.get(name) || [];
    existing.push(metric);

    // Keep only last 100 measurements per metric
    if (existing.length > 100) {
      existing.splice(0, existing.length - 100);
    }

    this.metrics.set(name, existing);
    
    console.log(`📈 [METRIC] ${name}: ${value}${unit}${tags ? ` (${JSON.stringify(tags)})` : ''}`);
  }

  /**
   * Record an error occurrence
   */
  recordError(error: string, severity: 'low' | 'medium' | 'high' | 'critical', service?: string): void {
    if (!FEATURE_FLAGS.enableMetrics) return;

    const existing = this.errors.get(error);
    
    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date();
      if (severity > existing.severity) {
        existing.severity = severity;
      }
    } else {
      this.errors.set(error, {
        error,
        count: 1,
        lastOccurrence: new Date(),
        severity,
        service,
      });
    }

    console.log(`🚨 [ERROR] ${severity.toUpperCase()}: ${error}${service ? ` (${service})` : ''}`);
  }

  /**
   * Get current system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const performanceMetrics: PerformanceMetric[] = [];
    
    // Flatten all metrics
    for (const [name, metrics] of this.metrics.entries()) {
      performanceMetrics.push(...metrics);
    }

    // Get service health
    const healthStatus = await serviceHealthMonitor.getHealthStatus();
    
    // Get network metrics
    const networkMetrics = networkManager.getMetrics();
    
    // Get cache stats
    const cacheStats = cacheManager.getStats();

    // Calculate uptime
    const uptime = Date.now() - this.startTime.getTime();

    return {
      performance: performanceMetrics.slice(-50), // Last 50 metrics
      errors: Array.from(this.errors.values()),
      services: healthStatus.services,
      cache: cacheStats,
      network: networkMetrics,
      uptime,
      timestamp: new Date(),
    };
  }

  /**
   * Get metrics for a specific service or metric name
   */
  getMetricsFor(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get error summary
   */
  getErrorSummary(): ErrorMetric[] {
    return Array.from(this.errors.values())
      .sort((a, b) => b.count - a.count) // Sort by frequency
      .slice(0, 20); // Top 20 errors
  }

  /**
   * Add custom alert
   */
  addAlert(alert: AlertConfig): void {
    this.alerts.push(alert);
    console.log(`🚨 [MONITORING] Added alert: ${alert.name} (${alert.severity})`);
  }

  /**
   * Remove alert by name
   */
  removeAlert(name: string): boolean {
    const initialLength = this.alerts.length;
    this.alerts = this.alerts.filter(alert => alert.name !== name);
    const removed = this.alerts.length < initialLength;
    
    if (removed) {
      console.log(`🗑️ [MONITORING] Removed alert: ${name}`);
    }
    
    return removed;
  }

  /**
   * Clear old metrics to prevent memory leaks
   */
  clearOldMetrics(maxAgeMs = 3600000): void { // Default 1 hour
    const cutoff = new Date(Date.now() - maxAgeMs);
    let clearedCount = 0;

    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(metric => metric.timestamp > cutoff);
      
      if (filtered.length !== metrics.length) {
        this.metrics.set(name, filtered);
        clearedCount += metrics.length - filtered.length;
      }
    }

    if (clearedCount > 0) {
      console.log(`🧹 [MONITORING] Cleared ${clearedCount} old metrics`);
    }
  }

  /**
   * Generate monitoring report
   */
  async generateReport(): Promise<string> {
    const metrics = await this.getSystemMetrics();
    const errorSummary = this.getErrorSummary();
    
    const report = `
# EchoFi System Monitoring Report
Generated: ${new Date().toISOString()}

## System Health
- Uptime: ${this.formatDuration(metrics.uptime)}
- Services: ${Object.values(metrics.services).filter((s: any) => s.isHealthy).length}/${Object.keys(metrics.services).length} healthy
- Cache Hit Rate: ${metrics.cache.hitRate.toFixed(1)}%
- Total Errors: ${metrics.errors.length}

## Network Performance
${Object.entries(metrics.network).map(([service, serviceMetrics]: [string, any]) => 
  `- ${service}: ${serviceMetrics.requests || 0} requests, ${serviceMetrics.successRate || 0}% success rate`
).join('\n')}

## Top Errors (Last Hour)
${errorSummary.slice(0, 5).map(error => 
  `- [${error.severity.toUpperCase()}] ${error.error}: ${error.count} occurrences`
).join('\n')}

## Cache Statistics
- Total Entries: ${metrics.cache.totalEntries}
- Total Size: ${this.formatBytes(metrics.cache.totalSize)}
- Hit Rate: ${metrics.cache.hitRate.toFixed(1)}%
- Evictions: ${metrics.cache.evictionCount}

## Recent Performance Metrics
${metrics.performance.slice(-10).map(metric => 
  `- ${metric.name}: ${metric.value}${metric.unit} (${metric.timestamp.toISOString()})`
).join('\n')}

---
Report generated by EchoFi Monitoring System
`;

    return report.trim();
  }

  // ========== Private Methods ==========

  private async collectSystemMetrics(): Promise<void> {
    try {
      // Record system uptime
      const uptime = Date.now() - this.startTime.getTime();
      this.recordMetric('system.uptime', uptime, 'ms');

      // Record service health metrics
      const healthStatus = await serviceHealthMonitor.getHealthStatus();
      this.recordMetric('services.healthy', healthStatus.overall.healthyServices, 'count');
      this.recordMetric('services.total', healthStatus.overall.totalServices, 'count');

      // Record cache metrics
      const cacheStats = cacheManager.getStats();
      this.recordMetric('cache.entries', cacheStats.totalEntries, 'count');
      this.recordMetric('cache.hit_rate', cacheStats.hitRate, '%');
      this.recordMetric('cache.size', cacheStats.totalSize, 'bytes');

      // Record network metrics
      const networkMetrics = networkManager.getMetrics();
      if (typeof networkMetrics === 'object' && networkMetrics !== null) {
        Object.entries(networkMetrics).forEach(([service, serviceMetrics]: [string, any]) => {
          if (serviceMetrics && typeof serviceMetrics === 'object') {
            this.recordMetric(`network.${service}.requests`, serviceMetrics.requests || 0, 'count');
            this.recordMetric(`network.${service}.failures`, serviceMetrics.failures || 0, 'count');
            this.recordMetric(`network.${service}.avg_response_time`, serviceMetrics.averageResponseTime || 0, 'ms');
          }
        });
      }

      // Record memory usage (approximate)
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        this.recordMetric('memory.used', memUsage.heapUsed, 'bytes');
        this.recordMetric('memory.total', memUsage.heapTotal, 'bytes');
      }

    } catch (error) {
      console.error('❌ [MONITORING] Failed to collect system metrics:', error);
      this.recordError('Failed to collect system metrics', 'medium', 'monitoring');
    }
  }

  private async checkAlerts(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics();
      
      for (const alert of this.alerts) {
        // Check cooldown
        const lastAlert = this.alertCooldowns.get(alert.name);
        if (lastAlert && Date.now() - lastAlert.getTime() < alert.cooldown) {
          continue;
        }

        // Check condition
        if (alert.condition(metrics)) {
          const message = alert.message(metrics);
          console.log(`🚨 [ALERT] ${alert.severity.toUpperCase()}: ${alert.name} - ${message}`);
          
          // Record alert as error
          this.recordError(`Alert: ${alert.name}`, alert.severity === 'critical' ? 'critical' : 'high', 'monitoring');
          
          // Set cooldown
          this.alertCooldowns.set(alert.name, new Date());
        }
      }
    } catch (error) {
      console.error('❌ [MONITORING] Failed to check alerts:', error);
    }
  }

  private setupDefaultAlerts(): void {
    // High error rate alert
    this.addAlert({
      name: 'High Error Rate',
      condition: (metrics) => {
        const recentErrors = metrics.errors.filter(
          error => Date.now() - error.lastOccurrence.getTime() < 300000 // Last 5 minutes
        );
        return recentErrors.length > 5;
      },
      severity: 'warning',
      message: (metrics) => `${metrics.errors.length} errors in the last 5 minutes`,
      cooldown: 300000, // 5 minutes
    });

    // Low cache hit rate alert
    this.addAlert({
      name: 'Low Cache Hit Rate',
      condition: (metrics) => metrics.cache.hitRate < 50,
      severity: 'info',
      message: (metrics) => `Cache hit rate is ${metrics.cache.hitRate.toFixed(1)}%`,
      cooldown: 600000, // 10 minutes
    });

    // Service health alert
    this.addAlert({
      name: 'Service Degradation',
      condition: (metrics) => {
        const healthyCount = Object.values(metrics.services).filter((s: any) => s.isHealthy).length;
        const totalCount = Object.keys(metrics.services).length;
        return totalCount > 0 && (healthyCount / totalCount) < 0.8; // Less than 80% healthy
      },
      severity: 'error',
      message: (metrics) => {
        const healthyCount = Object.values(metrics.services).filter((s: any) => s.isHealthy).length;
        const totalCount = Object.keys(metrics.services).length;
        return `Only ${healthyCount}/${totalCount} services are healthy`;
      },
      cooldown: 300000, // 5 minutes
    });
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }
}

// Export singleton instance
export const monitoringSystem = MonitoringSystem.getInstance();

// Helper functions
export function recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
  monitoringSystem.recordMetric(name, value, unit, tags);
}

export function recordError(error: string, severity: 'low' | 'medium' | 'high' | 'critical', service?: string): void {
  monitoringSystem.recordError(error, severity, service);
}

export function measureExecutionTime<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  return fn().then(
    result => {
      const duration = Date.now() - start;
      recordMetric(name, duration, 'ms');
      return result;
    },
    error => {
      const duration = Date.now() - start;
      recordMetric(name, duration, 'ms', { status: 'error' });
      throw error;
    }
  );
}