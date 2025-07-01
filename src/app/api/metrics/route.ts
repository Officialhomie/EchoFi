// src/app/api/metrics/route.ts
// Metrics and performance monitoring endpoint

import { NextRequest, NextResponse } from 'next/server';
import { monitoringSystem, recordMetric, recordError } from '@/lib/monitoring';
import { serviceHealthMonitor } from '@/lib/service-health';
import { cacheManager } from '@/lib/cache-manager';
import { networkManager } from '@/lib/network-utils';
import { SystemMetricsData, MetricsServiceData } from '@/types/api';

/**
 * Get system metrics
 * GET /api/metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const service = searchParams.get('service');
    const timeRange = searchParams.get('timeRange') || '1h';

    console.log(`📊 [METRICS] Metrics request - format: ${format}, service: ${service || 'all'}, range: ${timeRange}`);

    if (format === 'prometheus') {
      // Return Prometheus-format metrics
      const prometheusMetrics = await generatePrometheusMetrics();
      return new Response(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        },
      });
    }

    // Get comprehensive metrics
    const systemMetrics = await monitoringSystem.getSystemMetrics();
    const healthStatus = await serviceHealthMonitor.getHealthStatus();
    const cacheStats = cacheManager.getStats();
    const networkMetrics = networkManager.getMetrics();

    // Filter metrics by service if specified
    let filteredMetrics = systemMetrics;
    if (service) {
      filteredMetrics = {
        ...systemMetrics,
        performance: systemMetrics.performance.filter(
          metric => metric.name.includes(service) || metric.tags?.service === service
        ),
        errors: systemMetrics.errors.filter(
          error => error.service === service
        ),
      };
    }

    const metricsResponse = {
      timestamp: new Date().toISOString(),
      timeRange,
      system: {
        uptime: systemMetrics.uptime,
        performance: filteredMetrics.performance,
        errors: filteredMetrics.errors,
      },
      services: {
        health: healthStatus,
        degraded: serviceHealthMonitor.getDegradedServices(),
      },
      cache: cacheStats,
      network: networkMetrics,
      summary: {
        totalRequests: calculateTotalRequests(systemMetrics),
        errorRate: calculateErrorRate(systemMetrics),
        averageResponseTime: calculateAverageResponseTime(systemMetrics),
        cacheHitRate: cacheStats.hitRate,
        serviceHealthRate: (healthStatus.overall.healthyServices / healthStatus.overall.totalServices) * 100,
      },
    };

    return NextResponse.json(metricsResponse);

  } catch (error) {
    console.error('❌ [METRICS] Failed to retrieve metrics:', error);
    
    recordError('Failed to retrieve metrics', 'medium', 'metrics-api');
    
    return NextResponse.json({
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * Record custom metrics
 * POST /api/metrics
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metrics } = body;

    if (!Array.isArray(metrics)) {
      return NextResponse.json({
        error: 'Invalid request format. Expected array of metrics.',
      }, { status: 400 });
    }

    let recordedCount = 0;
    const errors: string[] = [];

    for (const metric of metrics) {
      try {
        const { name, value, unit, tags } = metric;
        
        if (!name || typeof value !== 'number' || !unit) {
          errors.push(`Invalid metric format: ${JSON.stringify(metric)}`);
          continue;
        }

        recordMetric(name, value, unit, tags);
        recordedCount++;
        
      } catch (metricError) {
        errors.push(`Failed to record metric: ${metricError}`);
      }
    }

    const response = {
      success: true,
      recorded: recordedCount,
      total: metrics.length,
      errors,
      timestamp: new Date().toISOString(),
    };

    if (errors.length > 0) {
      console.warn(`⚠️ [METRICS] Recorded ${recordedCount}/${metrics.length} metrics with ${errors.length} errors`);
    } else {
      console.log(`✅ [METRICS] Successfully recorded ${recordedCount} metrics`);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [METRICS] Failed to record metrics:', error);
    
    recordError('Failed to record metrics', 'medium', 'metrics-api');
    
    return NextResponse.json({
      error: 'Failed to record metrics',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// ========== Helper Functions ==========

async function generatePrometheusMetrics(): Promise<string> {
  const systemMetrics = await monitoringSystem.getSystemMetrics();
  const healthStatus = await serviceHealthMonitor.getHealthStatus();
  const cacheStats = cacheManager.getStats();
  
  let prometheusMetrics = '';
  
  // System uptime
  prometheusMetrics += `# HELP echofi_uptime_seconds System uptime in seconds\n`;
  prometheusMetrics += `# TYPE echofi_uptime_seconds counter\n`;
  prometheusMetrics += `echofi_uptime_seconds ${systemMetrics.uptime / 1000}\n\n`;
  
  // Service health
  prometheusMetrics += `# HELP echofi_service_healthy Service health status (1=healthy, 0=unhealthy)\n`;
  prometheusMetrics += `# TYPE echofi_service_healthy gauge\n`;
  Object.entries(healthStatus.services).forEach(([serviceName, service]: [string, any]) => {
    prometheusMetrics += `echofi_service_healthy{service="${serviceName}"} ${service.isHealthy ? 1 : 0}\n`;
  });
  prometheusMetrics += '\n';
  
  // Cache metrics
  prometheusMetrics += `# HELP echofi_cache_entries_total Total number of cache entries\n`;
  prometheusMetrics += `# TYPE echofi_cache_entries_total gauge\n`;
  prometheusMetrics += `echofi_cache_entries_total ${cacheStats.totalEntries}\n\n`;
  
  prometheusMetrics += `# HELP echofi_cache_hit_rate_percent Cache hit rate percentage\n`;
  prometheusMetrics += `# TYPE echofi_cache_hit_rate_percent gauge\n`;
  prometheusMetrics += `echofi_cache_hit_rate_percent ${cacheStats.hitRate}\n\n`;
  
  // Performance metrics
  prometheusMetrics += `# HELP echofi_errors_total Total number of errors\n`;
  prometheusMetrics += `# TYPE echofi_errors_total counter\n`;
  systemMetrics.errors.forEach(error => {
    const service = error.service || 'unknown';
    prometheusMetrics += `echofi_errors_total{service="${service}",severity="${error.severity}"} ${error.count}\n`;
  });
  prometheusMetrics += '\n';
  
  return prometheusMetrics;
}

function calculateTotalRequests(metrics: any): number {
  // Calculate total requests from network metrics
  if (typeof metrics.network === 'object' && metrics.network !== null) {
    return Object.values(metrics.network).reduce((total: number, serviceMetrics: any) => {
      return total + (serviceMetrics?.requests || 0);
    }, 0);
  }
  return 0;
}

function calculateErrorRate(metrics: any): number {
  const totalErrors = metrics.errors.reduce((sum: number, error: any) => sum + error.count, 0);
  const totalRequests = calculateTotalRequests(metrics);
  
  if (totalRequests === 0) return 0;
  return (totalErrors / totalRequests) * 100;
}

function calculateAverageResponseTime(metrics: any): number {
  const responseTimeMetrics = metrics.performance.filter((m: any) => 
    m.name.includes('response_time') && m.unit === 'ms'
  );
  
  if (responseTimeMetrics.length === 0) return 0;
  
  const totalTime = responseTimeMetrics.reduce((sum: number, metric: any) => sum + metric.value, 0);
  return totalTime / responseTimeMetrics.length;
}