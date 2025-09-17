import { NextRequest, NextResponse } from 'next/server';
import { healthCheckService } from '@/lib/monitoring/health-check';
import { requireRole } from '@/lib/auth/safe-auth';

/**
 * Build detailed health response
 */
function buildDetailedResponse(
  healthStatus: any,
  includeMetrics: boolean,
  includeHistory: boolean
): any {
  const response: any = {
    status: healthStatus.overall,
    timestamp: new Date().toISOString(),
    uptime: healthStatus.uptime,
    version: process.env.npm_package_version || '1.0.0',
    services: healthStatus.services.map((service: any) => ({
      name: service.service,
      status: service.status,
      latency: service.latency,
      error: service.error,
      details: service.details,
      lastChecked: new Date(service.lastChecked).toISOString(),
      timestamp: new Date(service.timestamp).toISOString(),
    })),
    summary: {
      totalServices: healthStatus.services.length,
      healthyServices: healthStatus.services.filter((s: any) => s.status === 'healthy').length,
      degradedServices: healthStatus.degradedServices.length,
      unhealthyServices: healthStatus.unhealthyServices.length,
      alertsCount: healthStatus.alerts.length,
    },
    alerts: healthStatus.alerts.map((alert: any) => ({
      id: alert.id,
      service: alert.service,
      type: alert.type,
      message: alert.message,
      timestamp: new Date(alert.timestamp).toISOString(),
      details: alert.details,
    })),
  };

  return response;
}

/**
 * Add metrics to response if requested
 */
async function addMetricsToResponse(response: any, includeMetrics: boolean): Promise<void> {
  if (!includeMetrics) return;

  const metrics = await healthCheckService.getPerformanceMetrics();
  response.metrics = {
    redis: {
      latency: `${metrics.redis.latency.toFixed(2)}ms`,
      operationsPerSecond: metrics.redis.operationsPerSecond,
      memoryUsage: `${(metrics.redis.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      connections: metrics.redis.connections,
    },
    database: {
      latency: `${metrics.database.latency.toFixed(2)}ms`,
      activeConnections: metrics.database.activeConnections,
      queryCount: metrics.database.queryCount,
      slowQueries: metrics.database.slowQueries,
    },
    clerk: {
      latency: `${metrics.clerk.latency.toFixed(2)}ms`,
      apiCalls: metrics.clerk.apiCalls,
      errorRate: `${(metrics.clerk.errorRate * 100).toFixed(2)}%`,
    },
    cache: {
      hits: metrics.cache.hits,
      misses: metrics.cache.misses,
      hitRatio: `${(metrics.cache.hitRatio * 100).toFixed(2)}%`,
      totalRequests: metrics.cache.totalRequests,
      averageLatency: `${metrics.cache.averageLatency.toFixed(2)}ms`,
    },
    timestamp: new Date(metrics.timestamp).toISOString(),
  };
}

/**
 * Add history to response if requested
 */
function addHistoryToResponse(response: any, healthStatus: any, includeHistory: boolean): void {
  if (!includeHistory) return;

  response.history = {
    lastCheck: healthStatus.timestamp,
    serviceHistory: healthStatus.services.map((service: any) => ({
      service: service.service,
      status: service.status,
      latency: service.latency,
      timestamp: service.timestamp,
    })),
  };
}

/**
 * Detailed Health Check
 *
 * Comprehensive health monitoring endpoint with detailed service information,
 * performance metrics, and alerting. Requires admin authentication.
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for detailed health information
    await requireRole('admin');

    const url = new URL(request.url);
    const includeMetrics = url.searchParams.get('metrics') === 'true';
    const includeHistory = url.searchParams.get('history') === 'true';

    // Perform comprehensive health check
    const healthStatus = await healthCheckService.performHealthCheck();

    // Build response
    const response = buildDetailedResponse(healthStatus, includeMetrics, includeHistory);
    await addMetricsToResponse(response, includeMetrics);
    addHistoryToResponse(response, healthStatus, includeHistory);

    // Determine response status based on overall health
    const statusCode = healthStatus.overall === 'healthy' ? 200 :
                      healthStatus.overall === 'degraded' ? 200 : 503;

    return NextResponse.json(response, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Detailed health check failed:', error);

    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('role')) {
      return NextResponse.json({
        status: 'unauthorized',
        error: 'Admin access required for detailed health information',
        timestamp: new Date().toISOString(),
      }, {
        status: 403,
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
        },
      });
    }

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * POST endpoint to manually trigger health check
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    await requireRole('admin');

    // Perform health check
    const healthStatus = await healthCheckService.performHealthCheck();

    return NextResponse.json({
      success: true,
      message: 'Health check completed',
      status: healthStatus.overall,
      timestamp: new Date().toISOString(),
      services: healthStatus.services.map(s => ({
        service: s.service,
        status: s.status,
        latency: s.latency,
      })),
      alerts: healthStatus.alerts.length,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Manual health check failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Manual health check failed',
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    });
  }
}