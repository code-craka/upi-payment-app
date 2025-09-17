import { NextRequest, NextResponse } from 'next/server';
import { healthCheckService } from '@/lib/monitoring/health-check';
import { requireRole } from '@/lib/auth/safe-auth';

/**
 * Metrics Endpoint for Monitoring Systems
 *
 * Provides metrics in Prometheus format for integration with monitoring systems
 * like Prometheus, Grafana, DataDog, etc.
 *
 * Supports:
 * - Prometheus exposition format
 * - Custom metric namespacing
 * - Service-specific metrics
 * - Performance and latency metrics
 * - Health status as metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Optional admin authentication (can be disabled for monitoring systems)
    const url = new URL(request.url);
    const requireAuth = url.searchParams.get('auth') !== 'false';

    if (requireAuth) {
      try {
        await requireRole('admin');
      } catch (error) {
        return NextResponse.json({
          error: 'Authentication required',
          timestamp: new Date().toISOString(),
        }, {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // Get current health status and metrics
    const healthStatus = await healthCheckService.performHealthCheck();
    const metrics = await healthCheckService.getPerformanceMetrics();

    // Build Prometheus-formatted metrics
    const prometheusMetrics = buildPrometheusMetrics(healthStatus, metrics);

    return new NextResponse(prometheusMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Metrics endpoint failed:', error);

    return NextResponse.json({
      error: 'Metrics collection failed',
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Build Prometheus-formatted metrics
 */
function buildPrometheusMetrics(healthStatus: any, metrics: any): string {
  const lines: string[] = [];
  const timestamp = Date.now();

  // Overall health status
  addHealthMetrics(lines, healthStatus, timestamp);

  // Service-specific metrics
  addServiceMetrics(lines, healthStatus, timestamp);

  // Redis metrics
  addRedisMetrics(lines, metrics.redis, timestamp);

  // Database metrics
  addDatabaseMetrics(lines, metrics.database, timestamp);

  // Clerk metrics
  addClerkMetrics(lines, metrics.clerk, timestamp);

  // Cache metrics
  addCacheMetrics(lines, metrics.cache, timestamp);

  // Application metrics
  addApplicationMetrics(lines, healthStatus, timestamp);

  return lines.join('\n') + '\n';
}

/**
 * Add overall health metrics
 */
function addHealthMetrics(lines: string[], healthStatus: any, timestamp: number): void {
  lines.push('# HELP upi_health_status Overall health status (0=healthy, 1=degraded, 2=unhealthy)');
  lines.push('# TYPE upi_health_status gauge');

  const statusValue = healthStatus.overall === 'healthy' ? 0 :
                     healthStatus.overall === 'degraded' ? 1 : 2;
  lines.push(`upi_health_status ${statusValue} ${timestamp}`);
}

/**
 * Add service-specific metrics
 */
function addServiceMetrics(lines: string[], healthStatus: any, timestamp: number): void {
  lines.push('# HELP upi_service_health_status Health status per service (0=healthy, 1=degraded, 2=unhealthy)');
  lines.push('# TYPE upi_service_health_status gauge');

  healthStatus.services.forEach((service: any) => {
    const value = service.status === 'healthy' ? 0 :
                 service.status === 'degraded' ? 1 : 2;
    lines.push(`upi_service_health_status{service="${service.service}"} ${value} ${timestamp}`);
  });

  lines.push('# HELP upi_service_latency_ms Service response latency in milliseconds');
  lines.push('# TYPE upi_service_latency_ms gauge');

  healthStatus.services.forEach((service: any) => {
    if (service.latency) {
      lines.push(`upi_service_latency_ms{service="${service.service}"} ${service.latency} ${timestamp}`);
    }
  });
}

/**
 * Add Redis metrics
 */
function addRedisMetrics(lines: string[], redisMetrics: any, timestamp: number): void {
  lines.push('# HELP upi_redis_latency_ms Redis operation latency in milliseconds');
  lines.push('# TYPE upi_redis_latency_ms gauge');
  lines.push(`upi_redis_latency_ms ${redisMetrics.latency} ${timestamp}`);

  lines.push('# HELP upi_redis_connections Redis connection count');
  lines.push('# TYPE upi_redis_connections gauge');
  lines.push(`upi_redis_connections ${redisMetrics.connections} ${timestamp}`);

  lines.push('# HELP upi_redis_memory_usage_bytes Redis memory usage in bytes');
  lines.push('# TYPE upi_redis_memory_usage_bytes gauge');
  lines.push(`upi_redis_memory_usage_bytes ${redisMetrics.memoryUsage} ${timestamp}`);
}

/**
 * Add database metrics
 */
function addDatabaseMetrics(lines: string[], dbMetrics: any, timestamp: number): void {
  lines.push('# HELP upi_database_latency_ms Database operation latency in milliseconds');
  lines.push('# TYPE upi_database_latency_ms gauge');
  lines.push(`upi_database_latency_ms ${dbMetrics.latency} ${timestamp}`);

  lines.push('# HELP upi_database_active_connections Database active connection count');
  lines.push('# TYPE upi_database_active_connections gauge');
  lines.push(`upi_database_active_connections ${dbMetrics.activeConnections} ${timestamp}`);

  lines.push('# HELP upi_database_query_count Total database query count');
  lines.push('# TYPE upi_database_query_count counter');
  lines.push(`upi_database_query_count ${dbMetrics.queryCount} ${timestamp}`);

  lines.push('# HELP upi_database_slow_queries_count Slow database query count');
  lines.push('# TYPE upi_database_slow_queries_count counter');
  lines.push(`upi_database_slow_queries_count ${dbMetrics.slowQueries} ${timestamp}`);
}

/**
 * Add Clerk metrics
 */
function addClerkMetrics(lines: string[], clerkMetrics: any, timestamp: number): void {
  lines.push('# HELP upi_clerk_latency_ms Clerk API latency in milliseconds');
  lines.push('# TYPE upi_clerk_latency_ms gauge');
  lines.push(`upi_clerk_latency_ms ${clerkMetrics.latency} ${timestamp}`);

  lines.push('# HELP upi_clerk_api_calls_total Total Clerk API calls');
  lines.push('# TYPE upi_clerk_api_calls_total counter');
  lines.push(`upi_clerk_api_calls_total ${clerkMetrics.apiCalls} ${timestamp}`);

  lines.push('# HELP upi_clerk_error_rate Clerk API error rate (0.0-1.0)');
  lines.push('# TYPE upi_clerk_error_rate gauge');
  lines.push(`upi_clerk_error_rate ${clerkMetrics.errorRate} ${timestamp}`);
}

/**
 * Add cache metrics
 */
function addCacheMetrics(lines: string[], cacheMetrics: any, timestamp: number): void {
  lines.push('# HELP upi_cache_hits_total Total cache hits');
  lines.push('# TYPE upi_cache_hits_total counter');
  lines.push(`upi_cache_hits_total ${cacheMetrics.hits} ${timestamp}`);

  lines.push('# HELP upi_cache_misses_total Total cache misses');
  lines.push('# TYPE upi_cache_misses_total counter');
  lines.push(`upi_cache_misses_total ${cacheMetrics.misses} ${timestamp}`);

  lines.push('# HELP upi_cache_hit_ratio Cache hit ratio (0.0-1.0)');
  lines.push('# TYPE upi_cache_hit_ratio gauge');
  lines.push(`upi_cache_hit_ratio ${cacheMetrics.hitRatio} ${timestamp}`);

  lines.push('# HELP upi_cache_requests_total Total cache requests');
  lines.push('# TYPE upi_cache_requests_total counter');
  lines.push(`upi_cache_requests_total ${cacheMetrics.totalRequests} ${timestamp}`);

  lines.push('# HELP upi_cache_latency_ms Cache operation latency in milliseconds');
  lines.push('# TYPE upi_cache_latency_ms gauge');
  lines.push(`upi_cache_latency_ms ${cacheMetrics.averageLatency} ${timestamp}`);
}

/**
 * Add application metrics
 */
function addApplicationMetrics(lines: string[], healthStatus: any, timestamp: number): void {
  lines.push('# HELP upi_uptime_seconds Application uptime in seconds');
  lines.push('# TYPE upi_uptime_seconds gauge');
  lines.push(`upi_uptime_seconds ${healthStatus.uptime} ${timestamp}`);

  lines.push('# HELP upi_alerts_total Total active alerts');
  lines.push('# TYPE upi_alerts_total gauge');
  lines.push(`upi_alerts_total ${healthStatus.alerts.length} ${timestamp}`);

  const healthyCount = healthStatus.services.filter((s: any) => s.status === 'healthy').length;
  const degradedCount = healthStatus.degradedServices.length;
  const unhealthyCount = healthStatus.unhealthyServices.length;

  lines.push('# HELP upi_services_healthy_total Total healthy services');
  lines.push('# TYPE upi_services_healthy_total gauge');
  lines.push(`upi_services_healthy_total ${healthyCount} ${timestamp}`);

  lines.push('# HELP upi_services_degraded_total Total degraded services');
  lines.push('# TYPE upi_services_degraded_total gauge');
  lines.push(`upi_services_degraded_total ${degradedCount} ${timestamp}`);

  lines.push('# HELP upi_services_unhealthy_total Total unhealthy services');
  lines.push('# TYPE upi_services_unhealthy_total gauge');
  lines.push(`upi_services_unhealthy_total ${unhealthyCount} ${timestamp}`);
}