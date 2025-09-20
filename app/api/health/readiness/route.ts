import { NextRequest, NextResponse } from 'next/server';
import { healthCheckService } from '@/lib/monitoring/health-check';

/**
 * Readiness Health Check
 *
 * Comprehensive health check to determine if the application is ready
 * to serve traffic. This includes checking all dependencies:
 * - Redis connection
 * - Database connection
 * - Clerk API connectivity
 * - Cache performance
 *
 * Returns 200 if all services are healthy, 503 if any critical service is unhealthy.
 */
export async function GET(_request: NextRequest) {
  try {
    // Perform comprehensive health check
    const healthStatus = await healthCheckService.performHealthCheck();

    // Determine readiness based on health status
    const isReady = healthStatus.overall === 'healthy' || healthStatus.overall === 'degraded';

    // Create response
    const response = {
      status: isReady ? 'ready' : 'not_ready',
      overall: healthStatus.overall,
      timestamp: new Date().toISOString(),
      uptime: healthStatus.uptime,
      services: healthStatus.services.map((service) => ({
        name: service.service,
        status: service.status,
        latency: service.latency ? `${service.latency.toFixed(2)}ms` : undefined,
        error: service.error,
      })),
      degradedServices: healthStatus.degradedServices,
      unhealthyServices: healthStatus.unhealthyServices,
      alerts: healthStatus.alerts.length,
    };

    return NextResponse.json(response, {
      status: isReady ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Readiness check failed:', error);

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Readiness check failed',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
