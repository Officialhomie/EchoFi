// src/app/api/health/route.ts
// Comprehensive health check endpoint for monitoring system status

import { NextRequest, NextResponse } from 'next/server';
import { serviceHealthMonitor } from '@/lib/service-health';
import { monitoringSystem, recordMetric } from '@/lib/monitoring';
import { cacheManager } from '@/lib/cache-manager';
import { networkManager } from '@/lib/network-utils';
import { FEATURE_FLAGS } from '@/lib/network-config';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  services: any;
  features: any;
  performance: any;
  cache: any;
  network: any;
  alerts?: any[];
}

/**
 * Comprehensive health check endpoint
 * GET /api/health
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('🏥 [HEALTH] Comprehensive health check initiated...');
    
    // Start monitoring systems if not already started
    if (FEATURE_FLAGS.enableHealthChecks) {
      serviceHealthMonitor.startMonitoring();
    }
    
    if (FEATURE_FLAGS.enableMetrics) {
      monitoringSystem.start();
    }

    // Get detailed service health
    const serviceHealth = await serviceHealthMonitor.getHealthStatus();
    
    // Get system metrics
    const systemMetrics = await monitoringSystem.getSystemMetrics();
    
    // Get cache statistics
    const cacheStats = cacheManager.getStats();
    
    // Get network metrics
    const networkMetrics = networkManager.getMetrics();
    
    // Calculate uptime
    const uptime = systemMetrics.uptime;
    
    // Determine overall health status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    
    if (serviceHealth.overall.systemStatus === 'operational') {
      overallStatus = 'healthy';
    } else if (serviceHealth.overall.systemStatus === 'degraded') {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    // Get recent error summary
    const errorSummary = monitoringSystem.getErrorSummary().slice(0, 5);

    const healthResponse: HealthResponse = {
      status: overallStatus,
      timestamp: new Date(),
      uptime,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        status: serviceHealth.overall.systemStatus,
        healthy: serviceHealth.overall.healthyServices,
        total: serviceHealth.overall.totalServices,
        details: serviceHealth.services,
        degraded: serviceHealthMonitor.getDegradedServices(),
      },
      features: {
        healthChecks: FEATURE_FLAGS.enableHealthChecks,
        networkRetries: FEATURE_FLAGS.enableNetworkRetries,
        circuitBreaker: FEATURE_FLAGS.enableCircuitBreaker,
        requestCaching: FEATURE_FLAGS.enableRequestCaching,
        metrics: FEATURE_FLAGS.enableMetrics,
        gracefulDegradation: FEATURE_FLAGS.gracefulDegradation,
      },
      performance: {
        responseTime: Date.now() - startTime,
        metrics: systemMetrics.performance.slice(-10), // Last 10 metrics
        errors: errorSummary,
      },
      cache: {
        ...cacheStats,
        enabled: FEATURE_FLAGS.enableRequestCaching,
      },
      network: {
        metrics: networkMetrics,
        retries: FEATURE_FLAGS.enableNetworkRetries,
        circuitBreaker: FEATURE_FLAGS.enableCircuitBreaker,
      },
    };

    // Record health check metrics
    recordMetric('health_check.response_time', Date.now() - startTime, 'ms');
    recordMetric('health_check.services_healthy', serviceHealth.overall.healthyServices, 'count');
    
    console.log(`✅ [HEALTH] Health check completed in ${Date.now() - startTime}ms - Status: ${overallStatus}`);
    
    // Return appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(healthResponse, { status: httpStatus });

  } catch (error) {
    console.error('❌ [HEALTH] Health check failed:', error);
    
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : String(error),
      uptime: 0,
      services: {
        status: 'down',
        healthy: 0,
        total: 0,
      },
      features: {
        healthChecks: false,
        networkRetries: false,
        circuitBreaker: false,
        requestCaching: false,
        metrics: false,
        gracefulDegradation: false,
      },
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * Update health check configuration
 * POST /api/health
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, service, config } = body;

    console.log(`🔧 [HEALTH] Health check action: ${action}`);

    switch (action) {
      case 'reset_circuit_breaker':
        if (service) {
          networkManager.resetCircuitBreaker(service);
          return NextResponse.json({ 
            success: true, 
            message: `Circuit breaker reset for ${service}` 
          });
        }
        break;

      case 'clear_cache':
        if (service) {
          cacheManager.deleteByTag(service);
        } else {
          cacheManager.clear();
        }
        return NextResponse.json({ 
          success: true, 
          message: service ? `Cache cleared for ${service}` : 'All cache cleared' 
        });

      case 'force_health_check':
        if (service) {
          const isHealthy = await serviceHealthMonitor.forceHealthCheck(service);
          return NextResponse.json({ 
            success: true, 
            healthy: isHealthy,
            message: `Health check completed for ${service}` 
          });
        } else {
          const healthStatus = await serviceHealthMonitor.getHealthStatus();
          return NextResponse.json({ 
            success: true, 
            status: healthStatus.overall.systemStatus,
            message: 'Full health check completed' 
          });
        }

      case 'enable_degraded_mode':
        if (service) {
          const fallbackMode = config?.fallbackMode || 'cache';
          serviceHealthMonitor.enableDegradedMode(service, fallbackMode);
          return NextResponse.json({ 
            success: true, 
            message: `Degraded mode enabled for ${service} (${fallbackMode})` 
          });
        }
        break;

      case 'disable_degraded_mode':
        if (service) {
          serviceHealthMonitor.disableDegradedMode(service);
          return NextResponse.json({ 
            success: true, 
            message: `Degraded mode disabled for ${service}` 
          });
        }
        break;

      case 'get_metrics':
        const metrics = await monitoringSystem.getSystemMetrics();
        return NextResponse.json({ 
          success: true, 
          metrics 
        });

      case 'generate_report':
        const report = await monitoringSystem.generateReport();
        return NextResponse.json({ 
          success: true, 
          report 
        });

      default:
        return NextResponse.json({ 
          success: false, 
          error: `Unknown action: ${action}` 
        }, { status: 400 });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Invalid parameters for action' 
    }, { status: 400 });

  } catch (error) {
    console.error('❌ [HEALTH] Health check action failed:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}