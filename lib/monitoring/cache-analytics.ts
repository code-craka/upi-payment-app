/**
 * Cache Hit Ratio Monitoring and Analytics Service
 *
 * Comprehensive cache monitoring system with real-time tracking, performance metrics,
 * trending analysis, and alerting for the UPI Admin Dashboard's Redis cache layer.
 */

import { redis } from '@/lib/redis';
import { performanceMonitor } from '@/lib/graceful-degradation/performance-monitor';

export interface CacheOperation {
  operationType: 'get' | 'set' | 'del' | 'exists' | 'scan' | 'multi' | 'pipeline';
  key?: string;
  keyPattern?: string;
  userRole?: string;
  userId?: string;
  hit: boolean;
  latency: number;
  dataSize?: number;
  ttl?: number;
  timestamp: Date;
  source?: string; // Which service/component made the request
}

export interface CacheMetrics {
  totalOperations: number;
  hits: number;
  misses: number;
  hitRatio: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  throughputPerSecond: number;
  memoryUsage: number;
  keyCount: number;
  evictions: number;
  connections: number;
  timestamp: Date;
}

export interface CacheAnalytics {
  overall: CacheMetrics;
  byOperationType: Record<string, CacheMetrics>;
  byUserRole: Record<string, CacheMetrics>;
  byTimeWindow: {
    last5Min: CacheMetrics;
    last1Hour: CacheMetrics;
    last24Hours: CacheMetrics;
    last7Days: CacheMetrics;
  };
  trends: {
    hitRatioTrend: number; // Percentage change from previous period
    latencyTrend: number;
    throughputTrend: number;
    memoryTrend: number;
  };
  alerts: CacheAlert[];
  recommendations: string[];
}

export interface CacheAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  metric: 'hitRatio' | 'latency' | 'throughput' | 'memory' | 'connections';
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
}

export interface CacheThresholds {
  hitRatio: {
    warning: number; // Below this triggers warning (e.g., 0.7 = 70%)
    critical: number; // Below this triggers critical (e.g., 0.5 = 50%)
  };
  latency: {
    warning: number; // Above this triggers warning (ms)
    critical: number; // Above this triggers critical (ms)
  };
  throughput: {
    warning: number; // Below this triggers warning (ops/sec)
    critical: number; // Below this triggers critical (ops/sec)
  };
  memory: {
    warning: number; // Above this triggers warning (percentage)
    critical: number; // Above this triggers critical (percentage)
  };
  connections: {
    warning: number; // Above this triggers warning
    critical: number; // Above this triggers critical
  };
}

class CacheMonitoringService {
  private static instance: CacheMonitoringService;
  private alertThresholds: CacheThresholds = {
    hitRatio: { warning: 0.7, critical: 0.5 },
    latency: { warning: 100, critical: 500 },
    throughput: { warning: 100, critical: 50 },
    memory: { warning: 0.8, critical: 0.95 },
    connections: { warning: 100, critical: 200 },
  };

  private constructor() {}

  public static getInstance(): CacheMonitoringService {
    if (!CacheMonitoringService.instance) {
      CacheMonitoringService.instance = new CacheMonitoringService();
    }
    return CacheMonitoringService.instance;
  }

  /**
   * Track a cache operation with detailed metrics
   */
  public async trackCacheOperation(operation: CacheOperation): Promise<void> {
    const timestamp = Date.now();
    const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const hourKey =
      new Date().toISOString().split('T')[0] +
      'T' +
      new Date().getHours().toString().padStart(2, '0');
    const minuteKey = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

    try {
      // Use pipeline for atomic operations
      const pipeline = redis.pipeline();

      // Overall counters
      const hitMissKey = operation.hit ? 'hits' : 'misses';
      pipeline.incr(`cache:metrics:total:${hitMissKey}`);
      pipeline.incr(`cache:metrics:total:operations`);

      // Time-based counters
      pipeline.incr(`cache:metrics:daily:${dateKey}:${hitMissKey}`);
      pipeline.incr(`cache:metrics:daily:${dateKey}:operations`);
      pipeline.incr(`cache:metrics:hourly:${hourKey}:${hitMissKey}`);
      pipeline.incr(`cache:metrics:hourly:${hourKey}:operations`);
      pipeline.incr(`cache:metrics:minute:${minuteKey}:${hitMissKey}`);
      pipeline.incr(`cache:metrics:minute:${minuteKey}:operations`);

      // Operation type counters
      if (operation.operationType) {
        pipeline.incr(`cache:metrics:operation:${operation.operationType}:${hitMissKey}`);
        pipeline.incr(`cache:metrics:operation:${operation.operationType}:operations`);
      }

      // User role counters
      if (operation.userRole) {
        pipeline.incr(`cache:metrics:role:${operation.userRole}:${hitMissKey}`);
        pipeline.incr(`cache:metrics:role:${operation.userRole}:operations`);
      }

      // Source/component counters
      if (operation.source) {
        pipeline.incr(`cache:metrics:source:${operation.source}:${hitMissKey}`);
        pipeline.incr(`cache:metrics:source:${operation.source}:operations`);
      }

      // Latency tracking (use sorted sets for percentiles)
      pipeline.zadd(`cache:latency:global`, operation.latency, timestamp);
      pipeline.zadd(
        `cache:latency:operation:${operation.operationType}`,
        operation.latency,
        timestamp,
      );
      if (operation.userRole) {
        pipeline.zadd(`cache:latency:role:${operation.userRole}`, operation.latency, timestamp);
      }

      // Data size tracking
      if (operation.dataSize !== undefined) {
        pipeline.zadd(`cache:datasize:global`, operation.dataSize, timestamp);
        pipeline.lpush(`cache:datasize:recent`, operation.dataSize);
        pipeline.ltrim(`cache:datasize:recent`, 0, 999); // Keep last 1000 sizes
      }

      // TTL tracking for cache efficiency analysis
      if (operation.ttl !== undefined) {
        pipeline.lpush(`cache:ttl:${operation.operationType}`, operation.ttl);
        pipeline.ltrim(`cache:ttl:${operation.operationType}`, 0, 99); // Keep last 100 TTL values
      }

      // Key pattern analysis
      if (operation.keyPattern) {
        pipeline.incr(`cache:patterns:${operation.keyPattern}:${hitMissKey}`);
        pipeline.incr(`cache:patterns:${operation.keyPattern}:operations`);
      }

      // Set expiration on time-based keys to prevent memory leaks
      pipeline.expire(`cache:metrics:minute:${minuteKey}:${hitMissKey}`, 3600); // 1 hour
      pipeline.expire(`cache:metrics:minute:${minuteKey}:operations`, 3600);
      pipeline.expire(`cache:metrics:hourly:${hourKey}:${hitMissKey}`, 86400 * 7); // 7 days
      pipeline.expire(`cache:metrics:hourly:${hourKey}:operations`, 86400 * 7);
      pipeline.expire(`cache:metrics:daily:${dateKey}:${hitMissKey}`, 86400 * 30); // 30 days
      pipeline.expire(`cache:metrics:daily:${dateKey}:operations`, 86400 * 30);

      // Clean old latency data (keep last hour for real-time metrics)
      const oneHourAgo = timestamp - 3600000;
      pipeline.zremrangebyscore(`cache:latency:global`, 0, oneHourAgo);
      pipeline.zremrangebyscore(
        `cache:latency:operation:${operation.operationType}`,
        0,
        oneHourAgo,
      );
      if (operation.userRole) {
        pipeline.zremrangebyscore(`cache:latency:role:${operation.userRole}`, 0, oneHourAgo);
      }

      await pipeline.exec();

      // Track with performance monitor for integration
      await performanceMonitor.recordMetric({
        operationName: `cache_${operation.operationType}`,
        service: 'cache',
        duration: operation.latency,
        timestamp: operation.timestamp,
        success: operation.hit,
        fallbackUsed: !operation.hit,
      });
    } catch (error) {
      console.error('Failed to track cache operation:', error);
    }
  }

  /**
   * Get comprehensive cache analytics
   */
  public async getCacheAnalytics(): Promise<CacheAnalytics> {
    try {
      // Get overall metrics
      const overall = await this.getOverallMetrics();

      // Get metrics by operation type
      const operations = ['get', 'set', 'del', 'exists', 'scan', 'multi', 'pipeline'];
      const byOperationType: Record<string, CacheMetrics> = {};
      for (const op of operations) {
        byOperationType[op] = await this.getMetricsByOperation(op);
      }

      // Get metrics by user role
      const roles = await this.getActiveRoles();
      const byUserRole: Record<string, CacheMetrics> = {};
      for (const role of roles) {
        byUserRole[role] = await this.getMetricsByRole(role);
      }

      // Get time window metrics
      const byTimeWindow = await this.getTimeWindowMetrics();

      // Calculate trends
      const trends = await this.calculateTrends();

      // Check for alerts
      const alerts = await this.checkAlerts(overall);

      // Generate recommendations
      const recommendations = this.generateRecommendations(overall, byOperationType, trends);

      return {
        overall,
        byOperationType,
        byUserRole,
        byTimeWindow,
        trends,
        alerts,
        recommendations,
      };
    } catch (error) {
      console.error('Failed to get cache analytics:', error);
      throw error;
    }
  }

  /**
   * Get overall cache metrics
   */
  private async getOverallMetrics(): Promise<CacheMetrics> {
    const pipeline = redis.pipeline();

    // Get basic counters
    pipeline.get('cache:metrics:total:hits');
    pipeline.get('cache:metrics:total:misses');
    pipeline.get('cache:metrics:total:operations');

    // Get basic Redis info
    pipeline.dbsize();

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Failed to execute Redis pipeline');
    }

    const hits = parseInt(((results[0] as [Error | null, unknown])?.[1] as string) || '0');
    const misses = parseInt(((results[1] as [Error | null, unknown])?.[1] as string) || '0');
    const totalOperations = parseInt(((results[2] as [Error | null, unknown])?.[1] as string) || '0');
    const keyCount = ((results[3] as [Error | null, unknown])?.[1] as number) || 0;

    const hitRatio = totalOperations > 0 ? hits / totalOperations : 0;

    // Get latency percentiles from sorted set
    const latencyMetrics = await this.getLatencyPercentiles('cache:latency:global');

    // Calculate throughput (operations per second in last minute)
    const throughput = await this.calculateThroughput();

    return {
      totalOperations,
      hits,
      misses,
      hitRatio,
      averageLatency: latencyMetrics.average,
      p50Latency: latencyMetrics.p50,
      p95Latency: latencyMetrics.p95,
      p99Latency: latencyMetrics.p99,
      throughputPerSecond: throughput,
      memoryUsage: 0, // Would need Redis INFO command to get memory usage
      keyCount,
      evictions: 0, // Would need Redis INFO command to get this
      connections: 0, // Would need Redis INFO command to get this
      timestamp: new Date(),
    };
  }

  /**
   * Get metrics for a specific operation type
   */
  private async getMetricsByOperation(operationType: string): Promise<CacheMetrics> {
    const pipeline = redis.pipeline();

    pipeline.get(`cache:metrics:operation:${operationType}:hits`);
    pipeline.get(`cache:metrics:operation:${operationType}:misses`);
    pipeline.get(`cache:metrics:operation:${operationType}:operations`);

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Failed to execute Redis pipeline');
    }

    const hits = parseInt(((results[0] as [Error | null, unknown])?.[1] as string) || '0');
    const misses = parseInt(((results[1] as [Error | null, unknown])?.[1] as string) || '0');
    const totalOperations = parseInt(((results[2] as [Error | null, unknown])?.[1] as string) || '0');

    const hitRatio = totalOperations > 0 ? hits / totalOperations : 0;
    const latencyMetrics = await this.getLatencyPercentiles(
      `cache:latency:operation:${operationType}`,
    );

    return {
      totalOperations,
      hits,
      misses,
      hitRatio,
      averageLatency: latencyMetrics.average,
      p50Latency: latencyMetrics.p50,
      p95Latency: latencyMetrics.p95,
      p99Latency: latencyMetrics.p99,
      throughputPerSecond: 0, // Would need time-based calculation
      memoryUsage: 0,
      keyCount: 0,
      evictions: 0,
      connections: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Get metrics for a specific user role
   */
  private async getMetricsByRole(role: string): Promise<CacheMetrics> {
    const pipeline = redis.pipeline();

    pipeline.get(`cache:metrics:role:${role}:hits`);
    pipeline.get(`cache:metrics:role:${role}:misses`);
    pipeline.get(`cache:metrics:role:${role}:operations`);

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Failed to execute Redis pipeline');
    }

    const hits = parseInt(((results[0] as [Error | null, unknown])?.[1] as string) || '0');
    const misses = parseInt(((results[1] as [Error | null, unknown])?.[1] as string) || '0');
    const totalOperations = parseInt(((results[2] as [Error | null, unknown])?.[1] as string) || '0');

    const hitRatio = totalOperations > 0 ? hits / totalOperations : 0;
    const latencyMetrics = await this.getLatencyPercentiles(`cache:latency:role:${role}`);

    return {
      totalOperations,
      hits,
      misses,
      hitRatio,
      averageLatency: latencyMetrics.average,
      p50Latency: latencyMetrics.p50,
      p95Latency: latencyMetrics.p95,
      p99Latency: latencyMetrics.p99,
      throughputPerSecond: 0,
      memoryUsage: 0,
      keyCount: 0,
      evictions: 0,
      connections: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Get time window metrics (5min, 1hour, 24hours, 7days)
   */
  private async getTimeWindowMetrics(): Promise<CacheAnalytics['byTimeWindow']> {
    const _now = new Date();

    // Calculate time windows
    const last5Min = await this.getMetricsForTimeWindow(5 * 60 * 1000); // 5 minutes
    const last1Hour = await this.getMetricsForTimeWindow(60 * 60 * 1000); // 1 hour
    const last24Hours = await this.getMetricsForTimeWindow(24 * 60 * 60 * 1000); // 24 hours
    const last7Days = await this.getMetricsForTimeWindow(7 * 24 * 60 * 60 * 1000); // 7 days

    return {
      last5Min,
      last1Hour,
      last24Hours,
      last7Days,
    };
  }

  /**
   * Calculate trends compared to previous periods
   */
  private async calculateTrends(): Promise<CacheAnalytics['trends']> {
    // Get current and previous period metrics
    const currentMetrics = await this.getMetricsForTimeWindow(60 * 60 * 1000); // Last hour
    const previousMetrics = await this.getMetricsForTimeWindow(60 * 60 * 1000, 60 * 60 * 1000); // Previous hour

    const calculateTrend = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      hitRatioTrend: calculateTrend(currentMetrics.hitRatio, previousMetrics.hitRatio),
      latencyTrend: calculateTrend(currentMetrics.averageLatency, previousMetrics.averageLatency),
      throughputTrend: calculateTrend(
        currentMetrics.throughputPerSecond,
        previousMetrics.throughputPerSecond,
      ),
      memoryTrend: calculateTrend(currentMetrics.memoryUsage, previousMetrics.memoryUsage),
    };
  }

  /**
   * Check for alerts based on thresholds
   */
  private async checkAlerts(metrics: CacheMetrics): Promise<CacheAlert[]> {
    const alerts: CacheAlert[] = [];
    const timestamp = new Date();

    // Check hit ratio
    if (metrics.hitRatio < this.alertThresholds.hitRatio.critical) {
      alerts.push({
        id: `hit-ratio-critical-${Date.now()}`,
        severity: 'critical',
        metric: 'hitRatio',
        message: `Cache hit ratio critically low: ${(metrics.hitRatio * 100).toFixed(1)}%`,
        currentValue: metrics.hitRatio,
        threshold: this.alertThresholds.hitRatio.critical,
        timestamp,
        acknowledged: false,
      });
    } else if (metrics.hitRatio < this.alertThresholds.hitRatio.warning) {
      alerts.push({
        id: `hit-ratio-warning-${Date.now()}`,
        severity: 'warning',
        metric: 'hitRatio',
        message: `Cache hit ratio low: ${(metrics.hitRatio * 100).toFixed(1)}%`,
        currentValue: metrics.hitRatio,
        threshold: this.alertThresholds.hitRatio.warning,
        timestamp,
        acknowledged: false,
      });
    }

    // Check latency
    if (metrics.p95Latency > this.alertThresholds.latency.critical) {
      alerts.push({
        id: `latency-critical-${Date.now()}`,
        severity: 'critical',
        metric: 'latency',
        message: `Cache P95 latency critically high: ${metrics.p95Latency.toFixed(1)}ms`,
        currentValue: metrics.p95Latency,
        threshold: this.alertThresholds.latency.critical,
        timestamp,
        acknowledged: false,
      });
    } else if (metrics.p95Latency > this.alertThresholds.latency.warning) {
      alerts.push({
        id: `latency-warning-${Date.now()}`,
        severity: 'warning',
        metric: 'latency',
        message: `Cache P95 latency high: ${metrics.p95Latency.toFixed(1)}ms`,
        currentValue: metrics.p95Latency,
        threshold: this.alertThresholds.latency.warning,
        timestamp,
        acknowledged: false,
      });
    }

    // Check throughput
    if (metrics.throughputPerSecond < this.alertThresholds.throughput.critical) {
      alerts.push({
        id: `throughput-critical-${Date.now()}`,
        severity: 'critical',
        metric: 'throughput',
        message: `Cache throughput critically low: ${metrics.throughputPerSecond.toFixed(1)} ops/sec`,
        currentValue: metrics.throughputPerSecond,
        threshold: this.alertThresholds.throughput.critical,
        timestamp,
        acknowledged: false,
      });
    }

    // Store alerts in Redis for persistence
    if (alerts.length > 0) {
      const pipeline = redis.pipeline();
      for (const alert of alerts) {
        pipeline.setex(`cache:alerts:${alert.id}`, 3600, JSON.stringify(alert)); // 1 hour expiry
        pipeline.lpush('cache:alerts:active', alert.id);
      }
      pipeline.ltrim('cache:alerts:active', 0, 99); // Keep last 100 alerts
      await pipeline.exec();
    }

    return alerts;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    overall: CacheMetrics,
    byOperationType: Record<string, CacheMetrics>,
    trends: CacheAnalytics['trends'],
  ): string[] {
    const recommendations: string[] = [];

    // Hit ratio recommendations
    if (overall.hitRatio < 0.8) {
      recommendations.push('Consider increasing cache TTL values to improve hit ratio');
      recommendations.push('Review cache key patterns for better data locality');
    }

    // Latency recommendations
    if (overall.p95Latency > 50) {
      recommendations.push('Investigate high cache latency - consider Redis memory optimization');
      recommendations.push('Monitor Redis memory usage and consider scaling if needed');
    }

    // Operation-specific recommendations
    const getMetrics = byOperationType['get'];
    if (getMetrics && getMetrics.hitRatio < 0.7) {
      recommendations.push('GET operations have low hit ratio - review caching strategy');
    }

    // Trend-based recommendations
    if (trends.hitRatioTrend < -10) {
      recommendations.push('Cache hit ratio is declining - investigate recent changes');
    }

    if (trends.latencyTrend > 20) {
      recommendations.push('Cache latency is increasing - monitor Redis performance');
    }

    if (trends.memoryTrend > 15) {
      recommendations.push(
        'Memory usage growing rapidly - consider implementing eviction policies',
      );
    }

    // Throughput recommendations
    if (overall.throughputPerSecond > 1000) {
      recommendations.push('High cache throughput detected - consider Redis clustering for scale');
    }

    return recommendations;
  }

  /**
   * Helper method to get latency percentiles from sorted set
   */
  private async getLatencyPercentiles(key: string): Promise<{
    average: number;
    p50: number;
    p95: number;
    p99: number;
  }> {
    try {
      // Get all latency values from the sorted set
      const values = await redis.zrange(key, 0, -1);

      if (values.length === 0) {
        return { average: 0, p50: 0, p95: 0, p99: 0 };
      }

      const latencies = values.map((v) => parseFloat(v as string)).sort((a, b) => a - b);
      const count = latencies.length;

      const average = latencies.reduce((sum, val) => sum + val, 0) / count;
      const p50 = latencies[Math.floor(count * 0.5)];
      const p95 = latencies[Math.floor(count * 0.95)];
      const p99 = latencies[Math.floor(count * 0.99)];

      return { average, p50, p95, p99 };
    } catch (error) {
      console.error(`Failed to get latency percentiles for ${key}:`, error);
      return { average: 0, p50: 0, p95: 0, p99: 0 };
    }
  }

  /**
   * Calculate current throughput (operations per second)
   */
  private async calculateThroughput(): Promise<number> {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      // Get operations count for the last minute
      const minuteKey = oneMinuteAgo.toISOString().slice(0, 16);
      const operations = await redis.get(`cache:metrics:minute:${minuteKey}:operations`);

      return operations ? parseInt(operations as string) / 60 : 0; // ops per second
    } catch (error) {
      console.error('Failed to calculate throughput:', error);
      return 0;
    }
  }

  /**
   * Get metrics for a specific time window
   */
  private async getMetricsForTimeWindow(
    windowMs: number,
    offsetMs: number = 0,
  ): Promise<CacheMetrics> {
    const endTime = Date.now() - offsetMs;
    const startTime = endTime - windowMs;

    // This is a simplified implementation - in production you'd aggregate
    // minute/hour level data depending on the time window
    const dateKeys = this.generateDateKeys(startTime, endTime, windowMs);

    let totalHits = 0;
    let totalMisses = 0;
    let totalOperations = 0;

    for (const dateKey of dateKeys) {
      const hits = await redis.get(`cache:metrics:daily:${dateKey}:hits`);
      const misses = await redis.get(`cache:metrics:daily:${dateKey}:misses`);
      const operations = await redis.get(`cache:metrics:daily:${dateKey}:operations`);

      totalHits += parseInt((hits as string) || '0');
      totalMisses += parseInt((misses as string) || '0');
      totalOperations += parseInt((operations as string) || '0');
    }

    const hitRatio = totalOperations > 0 ? totalHits / totalOperations : 0;

    return {
      totalOperations,
      hits: totalHits,
      misses: totalMisses,
      hitRatio,
      averageLatency: 0, // Would need to aggregate latency data
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughputPerSecond: totalOperations / (windowMs / 1000),
      memoryUsage: 0,
      keyCount: 0,
      evictions: 0,
      connections: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Generate date keys for time range
   */
  private generateDateKeys(startTime: number, endTime: number, _windowMs: number): string[] {
    const keys: string[] = [];

    // For windows less than a day, use daily keys
    // For longer windows, this would need more sophisticated logic
    const start = new Date(startTime);
    const end = new Date(endTime);

    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      keys.push(d.toISOString().split('T')[0]);
    }

    return keys;
  }

  /**
   * Get list of active user roles for metrics
   */
  private async getActiveRoles(): Promise<string[]> {
    try {
      const pattern = 'cache:metrics:role:*:operations';
      const keys = await redis.keys(pattern);

      return keys
        .map((key) => {
          const parts = key.split(':');
          return parts[3]; // Extract role from cache:metrics:role:ROLE:operations
        })
        .filter((role) => role && role !== 'operations');
    } catch (error) {
      console.error('Failed to get active roles:', error);
      return ['admin', 'user', 'super_admin']; // Default roles
    }
  }

  /**
   * Configure alert thresholds
   */
  public configureThresholds(thresholds: Partial<CacheThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }

  /**
   * Get current alert configuration
   */
  public getThresholds(): CacheThresholds {
    return { ...this.alertThresholds };
  }

  /**
   * Clear cache metrics (for testing or maintenance)
   */
  public async clearMetrics(): Promise<void> {
    const patterns = [
      'cache:metrics:*',
      'cache:latency:*',
      'cache:datasize:*',
      'cache:ttl:*',
      'cache:patterns:*',
      'cache:alerts:*',
    ];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  }

  /**
   * Export cache metrics to external monitoring systems
   */
  public async exportMetrics(): Promise<unknown> {
    const analytics = await this.getCacheAnalytics();

    // Format for external systems (e.g., Prometheus, DataDog)
    return {
      timestamp: Date.now(),
      metrics: {
        'cache.hit_ratio': analytics.overall.hitRatio,
        'cache.latency.p50': analytics.overall.p50Latency,
        'cache.latency.p95': analytics.overall.p95Latency,
        'cache.latency.p99': analytics.overall.p99Latency,
        'cache.throughput': analytics.overall.throughputPerSecond,
        'cache.memory_usage': analytics.overall.memoryUsage,
        'cache.key_count': analytics.overall.keyCount,
        'cache.operations_total': analytics.overall.totalOperations,
        'cache.hits_total': analytics.overall.hits,
        'cache.misses_total': analytics.overall.misses,
      },
      alerts: analytics.alerts.length,
      health: analytics.alerts.some((a) => a.severity === 'critical')
        ? 'critical'
        : analytics.alerts.some((a) => a.severity === 'warning')
          ? 'warning'
          : 'healthy',
    };
  }
}

/**
 * Singleton instance
 */
export const cacheMonitoring = CacheMonitoringService.getInstance();

/**
 * Convenience function to track cache operations
 */
export async function trackCacheHit(
  operationType: CacheOperation['operationType'],
  key: string,
  hit: boolean,
  latency: number,
  options: Partial<
    Pick<CacheOperation, 'userRole' | 'userId' | 'dataSize' | 'ttl' | 'source'>
  > = {},
): Promise<void> {
  return cacheMonitoring.trackCacheOperation({
    operationType,
    key,
    hit,
    latency,
    timestamp: new Date(),
    ...options,
  });
}

/**
 * Convenience function to get cache analytics
 */
export async function getCacheAnalytics(): Promise<CacheAnalytics> {
  return cacheMonitoring.getCacheAnalytics();
}
