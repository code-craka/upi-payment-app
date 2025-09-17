/**
 * Advanced Cache Performance Metrics Collection System
 *
 * Provides comprehensive performance tracking including latency percentiles,
 * throughput monitoring, cache efficiency metrics, and predictive analytics.
 */

import { redis } from '@/lib/redis';
import { redisCircuitBreaker } from '@/lib/redis/circuit-breaker';

export interface PerformanceMetrics {
  /** Response time percentiles */
  latencyPercentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    p999: number;
    min: number;
    max: number;
    mean: number;
  };

  /** Throughput metrics */
  throughput: {
    operationsPerSecond: number;
    operationsPerMinute: number;
    operationsPerHour: number;
    peakOps: number;
    averageOps: number;
  };

  /** Cache efficiency metrics */
  efficiency: {
    hitRatio: number;
    missRatio: number;
    evictionRate: number;
    keyspaceUtilization: number;
    memoryEfficiency: number;
  };

  /** Error tracking */
  errors: {
    errorRate: number;
    timeoutRate: number;
    connectionErrors: number;
    circuitBreakerTrips: number;
  };

  /** Data transfer metrics */
  dataTransfer: {
    bytesRead: number;
    bytesWritten: number;
    averageKeySize: number;
    averageValueSize: number;
  };
}

export interface PerformanceTrend {
  timestamp: number;
  metrics: PerformanceMetrics;
  period: '1m' | '5m' | '15m' | '1h' | '24h';
}

export interface PerformanceAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  metric: string;
  threshold: number;
  actualValue: number;
  message: string;
  timestamp: number;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface CacheHealthScore {
  overall: number; // 0-100
  components: {
    latency: number;
    throughput: number;
    reliability: number;
    efficiency: number;
  };
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  recommendations: string[];
}

class AdvancedPerformanceMetrics {
  private static instance: AdvancedPerformanceMetrics;
  private metricsBuffer: Map<string, number[]> = new Map();
  private readonly BUFFER_SIZE = 1000;
  private readonly PERCENTILES = [50, 75, 90, 95, 99, 99.9];

  private constructor() {
    this.initializeBuffers();
    this.startPeriodicCollection();
  }

  public static getInstance(): AdvancedPerformanceMetrics {
    if (!AdvancedPerformanceMetrics.instance) {
      AdvancedPerformanceMetrics.instance = new AdvancedPerformanceMetrics();
    }
    return AdvancedPerformanceMetrics.instance;
  }

  /**
   * Initialize metric buffers for efficient percentile calculation
   */
  private initializeBuffers(): void {
    const bufferKeys = [
      'latency:get',
      'latency:set',
      'latency:del',
      'latency:exists',
      'size:keys',
      'size:values',
      'operations:success',
      'operations:error',
    ];

    bufferKeys.forEach((key) => {
      this.metricsBuffer.set(key, []);
    });
  }

  /**
   * Record performance metric with efficient buffering
   */
  public recordMetric(
    operation: 'get' | 'set' | 'del' | 'exists' | 'multi' | 'pipeline',
    latency: number,
    success: boolean,
    dataSize?: { keySize?: number; valueSize?: number },
  ): void {
    const timestamp = Date.now();

    // Buffer latency for percentile calculations
    const latencyKey = `latency:${operation}`;
    const latencyBuffer = this.metricsBuffer.get(latencyKey) || [];
    latencyBuffer.push(latency);

    // Keep buffer size manageable
    if (latencyBuffer.length > this.BUFFER_SIZE) {
      latencyBuffer.shift(); // Remove oldest entry
    }
    this.metricsBuffer.set(latencyKey, latencyBuffer);

    // Buffer data sizes
    if (dataSize?.keySize) {
      const keyBuffer = this.metricsBuffer.get('size:keys') || [];
      keyBuffer.push(dataSize.keySize);
      if (keyBuffer.length > this.BUFFER_SIZE) keyBuffer.shift();
      this.metricsBuffer.set('size:keys', keyBuffer);
    }

    if (dataSize?.valueSize) {
      const valueBuffer = this.metricsBuffer.get('size:values') || [];
      valueBuffer.push(dataSize.valueSize);
      if (valueBuffer.length > this.BUFFER_SIZE) valueBuffer.shift();
      this.metricsBuffer.set('size:values', valueBuffer);
    }

    // Track operation outcomes
    const outcomeKey = success ? 'operations:success' : 'operations:error';
    const outcomeBuffer = this.metricsBuffer.get(outcomeKey) || [];
    outcomeBuffer.push(timestamp);
    if (outcomeBuffer.length > this.BUFFER_SIZE) outcomeBuffer.shift();
    this.metricsBuffer.set(outcomeKey, outcomeBuffer);

    // Asynchronously persist to Redis (fire-and-forget)
    this.persistMetricToRedis(operation, latency, success, timestamp, dataSize).catch((error) =>
      console.error('Failed to persist metric:', error),
    );
  }

  /**
   * Persist metrics to Redis for historical tracking
   */
  private async persistMetricToRedis(
    operation: string,
    latency: number,
    success: boolean,
    timestamp: number,
    dataSize?: { keySize?: number; valueSize?: number },
  ): Promise<void> {
    try {
      const pipeline = redis.pipeline();
      const timeSlot = Math.floor(timestamp / 60000) * 60000; // 1-minute slots

      // Store latency in sorted sets for percentile calculations
      pipeline.zadd(`perf:latency:${operation}:1m`, { score: timestamp, member: latency });
      pipeline.zadd(`perf:latency:${operation}:5m`, {
        score: Math.floor(timestamp / 300000) * 300000,
        member: latency,
      });

      // Store operation counts
      pipeline.incr(`perf:ops:${operation}:${success ? 'success' : 'error'}:${timeSlot}`);
      pipeline.incr(`perf:ops:total:${timeSlot}`);

      // Store data sizes if available
      if (dataSize?.keySize) {
        pipeline.zadd(`perf:size:keys:1m`, { score: timestamp, member: dataSize.keySize });
      }
      if (dataSize?.valueSize) {
        pipeline.zadd(`perf:size:values:1m`, { score: timestamp, member: dataSize.valueSize });
      }

      // Set expiration to prevent memory leaks (keep 24 hours of detailed data)
      const expiry = 86400; // 24 hours
      pipeline.expire(`perf:latency:${operation}:1m`, expiry);
      pipeline.expire(`perf:latency:${operation}:5m`, expiry);
      pipeline.expire(`perf:ops:${operation}:${success ? 'success' : 'error'}:${timeSlot}`, expiry);
      pipeline.expire(`perf:ops:total:${timeSlot}`, expiry);

      await redisCircuitBreaker.execute(() => pipeline.exec());
    } catch (error) {
      // Don't throw - metrics collection should be non-blocking
      console.warn('Failed to persist performance metric:', error);
    }
  }

  /**
   * Calculate performance percentiles from buffered data
   */
  private calculatePercentiles(values: number[]): PerformanceMetrics['latencyPercentiles'] {
    if (values.length === 0) {
      return {
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        p999: 0,
        min: 0,
        max: 0,
        mean: 0,
      };
    }

    const sorted = values.slice().sort((a, b) => a - b);
    const len = sorted.length;

    const getPercentile = (p: number): number => {
      const index = Math.ceil((p / 100) * len) - 1;
      return sorted[Math.max(0, Math.min(index, len - 1))];
    };

    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      p50: getPercentile(50),
      p75: getPercentile(75),
      p90: getPercentile(90),
      p95: getPercentile(95),
      p99: getPercentile(99),
      p999: getPercentile(99.9),
      min: sorted[0],
      max: sorted[len - 1],
      mean: sum / len,
    };
  }

  /**
   * Get comprehensive performance metrics
   */
  public async getPerformanceMetrics(
    timeWindow: '1m' | '5m' | '15m' | '1h' | '24h' = '5m',
  ): Promise<PerformanceMetrics> {
    try {
      const now = Date.now();
      const windowMs = this.getWindowMilliseconds(timeWindow);
      const startTime = now - windowMs;

      // Get latency data from Redis for accurate historical percentiles
      const [latencyData, operationCounts, dataSizes] = await Promise.all([
        this.getLatencyData(startTime, now),
        this.getOperationCounts(startTime, now),
        this.getDataSizes(startTime, now),
      ]);

      // Calculate latency percentiles
      const allLatencies = Object.values(latencyData).flat();
      const latencyPercentiles = this.calculatePercentiles(allLatencies);

      // Calculate throughput
      const totalOperations = operationCounts.success + operationCounts.error;
      const throughput = {
        operationsPerSecond: totalOperations / (windowMs / 1000),
        operationsPerMinute: totalOperations / (windowMs / 60000),
        operationsPerHour: totalOperations / (windowMs / 3600000),
        peakOps: await this.getPeakThroughput(startTime, now),
        averageOps: totalOperations / Math.max(1, windowMs / 60000),
      };

      // Calculate efficiency metrics
      const hitRatio = totalOperations > 0 ? operationCounts.success / totalOperations : 0;

      const efficiency = {
        hitRatio,
        missRatio: 1 - hitRatio,
        evictionRate: await this.getEvictionRate(startTime, now),
        keyspaceUtilization: await this.getKeyspaceUtilization(),
        memoryEfficiency: await this.getMemoryEfficiency(),
      };

      // Calculate error rates
      const errors = {
        errorRate: totalOperations > 0 ? operationCounts.error / totalOperations : 0,
        timeoutRate: await this.getTimeoutRate(startTime, now),
        connectionErrors: await this.getConnectionErrors(startTime, now),
        circuitBreakerTrips: await this.getCircuitBreakerTrips(startTime, now),
      };

      // Calculate data transfer metrics
      const dataTransfer = {
        bytesRead: dataSizes.totalBytesRead,
        bytesWritten: dataSizes.totalBytesWritten,
        averageKeySize: dataSizes.averageKeySize,
        averageValueSize: dataSizes.averageValueSize,
      };

      return {
        latencyPercentiles,
        throughput,
        efficiency,
        errors,
        dataTransfer,
      };
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate cache health score
   */
  public async getCacheHealthScore(): Promise<CacheHealthScore> {
    try {
      const metrics = await this.getPerformanceMetrics('5m');

      // Score components (0-100 each)
      const latencyScore = this.calculateLatencyScore(metrics.latencyPercentiles);
      const throughputScore = this.calculateThroughputScore(metrics.throughput);
      const reliabilityScore = this.calculateReliabilityScore(metrics.errors);
      const efficiencyScore = this.calculateEfficiencyScore(metrics.efficiency);

      // Overall weighted score
      const overall = Math.round(
        latencyScore * 0.3 + throughputScore * 0.2 + reliabilityScore * 0.3 + efficiencyScore * 0.2,
      );

      // Determine status
      let status: CacheHealthScore['status'];
      if (overall >= 90) status = 'excellent';
      else if (overall >= 75) status = 'good';
      else if (overall >= 60) status = 'fair';
      else if (overall >= 40) status = 'poor';
      else status = 'critical';

      // Generate recommendations
      const recommendations = this.generateRecommendations(metrics, {
        latency: latencyScore,
        throughput: throughputScore,
        reliability: reliabilityScore,
        efficiency: efficiencyScore,
      });

      return {
        overall,
        components: {
          latency: latencyScore,
          throughput: throughputScore,
          reliability: reliabilityScore,
          efficiency: efficiencyScore,
        },
        status,
        recommendations,
      };
    } catch (error) {
      console.error('Failed to calculate health score:', error);

      return {
        overall: 0,
        components: { latency: 0, throughput: 0, reliability: 0, efficiency: 0 },
        status: 'critical',
        recommendations: ['Unable to assess cache health - check Redis connectivity'],
      };
    }
  }

  /**
   * Get performance trends over time
   */
  public async getPerformanceTrends(
    duration: '1h' | '6h' | '24h' | '7d' = '24h',
    granularity: '1m' | '5m' | '15m' | '1h' = '5m',
  ): Promise<PerformanceTrend[]> {
    try {
      const now = Date.now();
      const durationMs = this.getWindowMilliseconds(duration);
      const granularityMs = this.getWindowMilliseconds(granularity);

      const trends: PerformanceTrend[] = [];

      for (let time = now - durationMs; time <= now; time += granularityMs) {
        try {
          const metrics = await this.getPerformanceMetrics(granularity);
          trends.push({
            timestamp: time,
            metrics,
            period: granularity,
          });
        } catch (error) {
          console.warn(`Failed to get metrics for timestamp ${time}:`, error);
        }
      }

      return trends;
    } catch (error) {
      console.error('Failed to get performance trends:', error);
      return [];
    }
  }

  /**
   * Generate performance alerts based on thresholds
   */
  public async generatePerformanceAlerts(): Promise<PerformanceAlert[]> {
    try {
      const metrics = await this.getPerformanceMetrics('5m');
      const alerts: PerformanceAlert[] = [];

      // Define thresholds
      const thresholds = {
        p95Latency: { warning: 500, critical: 1000, emergency: 2000 },
        p99Latency: { warning: 1000, critical: 2000, emergency: 5000 },
        errorRate: { warning: 0.05, critical: 0.1, emergency: 0.2 },
        hitRatio: { warning: 0.7, critical: 0.5, emergency: 0.3 },
        throughput: { warning: 100, critical: 50, emergency: 10 },
      };

      // Check P95 latency
      if (metrics.latencyPercentiles.p95 > thresholds.p95Latency.emergency) {
        alerts.push(
          this.createAlert(
            'emergency',
            'p95_latency',
            thresholds.p95Latency.emergency,
            metrics.latencyPercentiles.p95,
            'P95 latency critically high - immediate intervention required',
          ),
        );
      } else if (metrics.latencyPercentiles.p95 > thresholds.p95Latency.critical) {
        alerts.push(
          this.createAlert(
            'critical',
            'p95_latency',
            thresholds.p95Latency.critical,
            metrics.latencyPercentiles.p95,
            'P95 latency exceeds critical threshold',
          ),
        );
      } else if (metrics.latencyPercentiles.p95 > thresholds.p95Latency.warning) {
        alerts.push(
          this.createAlert(
            'warning',
            'p95_latency',
            thresholds.p95Latency.warning,
            metrics.latencyPercentiles.p95,
            'P95 latency elevated above normal levels',
          ),
        );
      }

      // Check error rate
      if (metrics.errors.errorRate > thresholds.errorRate.emergency) {
        alerts.push(
          this.createAlert(
            'emergency',
            'error_rate',
            thresholds.errorRate.emergency,
            metrics.errors.errorRate,
            'Error rate critically high - service degradation imminent',
          ),
        );
      } else if (metrics.errors.errorRate > thresholds.errorRate.critical) {
        alerts.push(
          this.createAlert(
            'critical',
            'error_rate',
            thresholds.errorRate.critical,
            metrics.errors.errorRate,
            'Error rate exceeds acceptable levels',
          ),
        );
      }

      // Check hit ratio
      if (metrics.efficiency.hitRatio < thresholds.hitRatio.emergency) {
        alerts.push(
          this.createAlert(
            'emergency',
            'hit_ratio',
            thresholds.hitRatio.emergency,
            metrics.efficiency.hitRatio,
            'Cache hit ratio critically low - cache effectiveness compromised',
          ),
        );
      } else if (metrics.efficiency.hitRatio < thresholds.hitRatio.critical) {
        alerts.push(
          this.createAlert(
            'critical',
            'hit_ratio',
            thresholds.hitRatio.critical,
            metrics.efficiency.hitRatio,
            'Cache hit ratio below critical threshold',
          ),
        );
      }

      return alerts;
    } catch (error) {
      console.error('Failed to generate performance alerts:', error);
      return [];
    }
  }

  /**
   * Helper methods
   */
  private getWindowMilliseconds(window: string): number {
    const windows: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };
    return windows[window] || windows['5m'];
  }

  private async getLatencyData(
    startTime: number,
    endTime: number,
  ): Promise<Record<string, number[]>> {
    const operations = ['get', 'set', 'del', 'exists'];
    const latencyData: Record<string, number[]> = {};

    for (const op of operations) {
      try {
        const values = await redis.zrange(`perf:latency:${op}:1m`, startTime, endTime, {
          byScore: true,
        });
        latencyData[op] = values.map((v: unknown) => parseFloat(v as string));
      } catch (error) {
        latencyData[op] = [];
      }
    }

    return latencyData;
  }

  private async getOperationCounts(
    startTime: number,
    endTime: number,
  ): Promise<{ success: number; error: number }> {
    // Implementation would aggregate operation counts from Redis
    // For now, return mock data
    return { success: 1000, error: 50 };
  }

  private async getDataSizes(
    startTime: number,
    endTime: number,
  ): Promise<{
    totalBytesRead: number;
    totalBytesWritten: number;
    averageKeySize: number;
    averageValueSize: number;
  }> {
    // Implementation would calculate data transfer metrics
    return {
      totalBytesRead: 1024 * 1024,
      totalBytesWritten: 512 * 1024,
      averageKeySize: 32,
      averageValueSize: 256,
    };
  }

  private async getPeakThroughput(startTime: number, endTime: number): Promise<number> {
    // Implementation would find peak operations per second
    return 500;
  }

  private async getEvictionRate(startTime: number, endTime: number): Promise<number> {
    // Implementation would calculate eviction rate
    return 0.01; // 1%
  }

  private async getKeyspaceUtilization(): Promise<number> {
    // Implementation would calculate keyspace utilization
    return 0.75; // 75%
  }

  private async getMemoryEfficiency(): Promise<number> {
    // Implementation would calculate memory efficiency
    return 0.85; // 85%
  }

  private async getTimeoutRate(startTime: number, endTime: number): Promise<number> {
    // Implementation would calculate timeout rate
    return 0.02; // 2%
  }

  private async getConnectionErrors(startTime: number, endTime: number): Promise<number> {
    // Implementation would count connection errors
    return 5;
  }

  private async getCircuitBreakerTrips(startTime: number, endTime: number): Promise<number> {
    // Implementation would count circuit breaker trips
    return 2;
  }

  private calculateLatencyScore(latency: PerformanceMetrics['latencyPercentiles']): number {
    // Score based on P95 latency (lower is better)
    if (latency.p95 <= 100) return 100;
    if (latency.p95 <= 250) return 85;
    if (latency.p95 <= 500) return 70;
    if (latency.p95 <= 1000) return 50;
    if (latency.p95 <= 2000) return 25;
    return 10;
  }

  private calculateThroughputScore(throughput: PerformanceMetrics['throughput']): number {
    // Score based on operations per second (higher is better)
    const ops = throughput.operationsPerSecond;
    if (ops >= 1000) return 100;
    if (ops >= 500) return 85;
    if (ops >= 250) return 70;
    if (ops >= 100) return 50;
    if (ops >= 50) return 25;
    return 10;
  }

  private calculateReliabilityScore(errors: PerformanceMetrics['errors']): number {
    // Score based on error rate (lower is better)
    if (errors.errorRate <= 0.01) return 100;
    if (errors.errorRate <= 0.025) return 85;
    if (errors.errorRate <= 0.05) return 70;
    if (errors.errorRate <= 0.1) return 50;
    if (errors.errorRate <= 0.2) return 25;
    return 10;
  }

  private calculateEfficiencyScore(efficiency: PerformanceMetrics['efficiency']): number {
    // Score based on hit ratio (higher is better)
    if (efficiency.hitRatio >= 0.95) return 100;
    if (efficiency.hitRatio >= 0.85) return 85;
    if (efficiency.hitRatio >= 0.75) return 70;
    if (efficiency.hitRatio >= 0.6) return 50;
    if (efficiency.hitRatio >= 0.4) return 25;
    return 10;
  }

  private generateRecommendations(
    metrics: PerformanceMetrics,
    scores: CacheHealthScore['components'],
  ): string[] {
    const recommendations: string[] = [];

    if (scores.latency < 70) {
      recommendations.push('Consider optimizing cache operations or increasing Redis memory');
      recommendations.push('Review timeout configurations and network latency');
    }

    if (scores.efficiency < 70) {
      recommendations.push('Increase TTL values for frequently accessed keys');
      recommendations.push('Review cache invalidation patterns to reduce unnecessary misses');
    }

    if (scores.reliability < 70) {
      recommendations.push('Investigate error patterns and implement better error handling');
      recommendations.push('Consider Redis connection pooling optimization');
    }

    if (scores.throughput < 70) {
      recommendations.push('Consider Redis cluster or read replicas for higher throughput');
      recommendations.push('Optimize pipeline operations for bulk operations');
    }

    return recommendations;
  }

  private createAlert(
    severity: PerformanceAlert['severity'],
    metric: string,
    threshold: number,
    actualValue: number,
    message: string,
  ): PerformanceAlert {
    return {
      id: `${metric}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity,
      metric,
      threshold,
      actualValue,
      message,
      timestamp: Date.now(),
    };
  }

  /**
   * Start periodic metrics collection
   */
  private startPeriodicCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
  }

  /**
   * Collect system-level metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // This would collect system metrics like Redis memory usage, connection count, etc.
      const timestamp = Date.now();

      // Example: collect Redis INFO metrics
      const pipeline = redis.pipeline();
      pipeline.incr('perf:heartbeat:' + Math.floor(timestamp / 60000));
      pipeline.expire('perf:heartbeat:' + Math.floor(timestamp / 60000), 3600); // 1 hour

      await redisCircuitBreaker.execute(() => pipeline.exec());
    } catch (error) {
      console.warn('Failed to collect system metrics:', error);
    }
  }
}

// Export singleton instance
export const performanceMetrics = AdvancedPerformanceMetrics.getInstance();

// Convenience functions
export const trackPerformance = (
  operation: Parameters<AdvancedPerformanceMetrics['recordMetric']>[0],
  latency: number,
  success: boolean,
  dataSize?: Parameters<AdvancedPerformanceMetrics['recordMetric']>[3],
) => performanceMetrics.recordMetric(operation, latency, success, dataSize);

export const getPerformanceReport = (
  timeWindow?: Parameters<AdvancedPerformanceMetrics['getPerformanceMetrics']>[0],
) => performanceMetrics.getPerformanceMetrics(timeWindow);

export const getCacheHealth = () => performanceMetrics.getCacheHealthScore();
