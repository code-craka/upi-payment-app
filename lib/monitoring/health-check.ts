import { redis, testRedisConnection } from '@/lib/redis';
import { connectDB } from '@/lib/db/connection';
import { currentUser } from '@clerk/nextjs/server';
import { RedisCircuitBreaker } from '@/lib/redis/circuit-breaker';
import { webhookLogger } from '@/lib/webhooks/logging-service';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  details?: Record<string, any>;
  timestamp: number;
  lastChecked: number;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: HealthCheckResult[];
  uptime: number;
  timestamp: number;
  alerts: HealthAlert[];
  degradedServices: string[];
  unhealthyServices: string[];
}

export interface HealthAlert {
  id: string;
  service: string;
  type: 'degraded' | 'unhealthy' | 'recovered';
  message: string;
  timestamp: number;
  details?: Record<string, any>;
}

export interface HealthCheckConfig {
  redis: {
    enabled: boolean;
    timeout: number;
    degradedThreshold: number; // ms
    unhealthyThreshold: number; // ms
  };
  clerk: {
    enabled: boolean;
    timeout: number;
    degradedThreshold: number; // ms
    unhealthyThreshold: number; // ms
  };
  database: {
    enabled: boolean;
    timeout: number;
    degradedThreshold: number; // ms
    unhealthyThreshold: number; // ms
  };
  cache: {
    enabled: boolean;
    timeout: number;
    minHitRatio: number; // minimum acceptable hit ratio
  };
  alerting: {
    enabled: boolean;
    alertCooldown: number; // ms between alerts for same service
    maxAlerts: number; // maximum alerts to keep in memory
  };
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRatio: number;
  totalRequests: number;
  averageLatency: number;
  timestamp: number;
}

export interface PerformanceMetrics {
  redis: {
    latency: number;
    operationsPerSecond: number;
    memoryUsage: number;
    connections: number;
  };
  database: {
    latency: number;
    activeConnections: number;
    queryCount: number;
    slowQueries: number;
  };
  clerk: {
    latency: number;
    apiCalls: number;
    errorRate: number;
  };
  cache: CacheMetrics;
  timestamp: number;
}

export class HealthCheckService {
  private static instance: HealthCheckService;
  private config: Required<HealthCheckConfig>;
  private circuitBreaker: RedisCircuitBreaker;
  private alerts: Map<string, HealthAlert> = new Map();
  private lastHealthCheck: HealthStatus | null = null;
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private serviceHealthCache: Map<string, HealthCheckResult> = new Map();

  private constructor(config?: Partial<HealthCheckConfig>) {
    this.config = {
      redis: {
        enabled: true,
        timeout: 5000,
        degradedThreshold: 100,
        unhealthyThreshold: 1000,
        ...config?.redis,
      },
      clerk: {
        enabled: true,
        timeout: 10000,
        degradedThreshold: 500,
        unhealthyThreshold: 2000,
        ...config?.clerk,
      },
      database: {
        enabled: true,
        timeout: 5000,
        degradedThreshold: 200,
        unhealthyThreshold: 1000,
        ...config?.database,
      },
      cache: {
        enabled: true,
        timeout: 3000,
        minHitRatio: 0.6,
        ...config?.cache,
      },
      alerting: {
        enabled: true,
        alertCooldown: 300000, // 5 minutes
        maxAlerts: 100,
        ...config?.alerting,
      },
    };

    this.circuitBreaker = new RedisCircuitBreaker();
  }

  static getInstance(config?: Partial<HealthCheckConfig>): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService(config);
    }
    return HealthCheckService.instance;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    const services: HealthCheckResult[] = [];

    // Run all health checks in parallel
    const checks = await Promise.allSettled([
      this.checkRedisHealth(),
      this.checkClerkHealth(),
      this.checkDatabaseHealth(),
      this.checkCacheHealth(),
    ]);

    // Process results
    checks.forEach((result, index) => {
      const serviceNames = ['redis', 'clerk', 'database', 'cache'];
      const serviceName = serviceNames[index];

      if (result.status === 'fulfilled') {
        services.push(result.value);
        this.serviceHealthCache.set(serviceName, result.value);
      } else {
        const errorResult: HealthCheckResult = {
          service: serviceName,
          status: 'unhealthy',
          error: result.reason?.message || 'Health check failed',
          timestamp: Date.now(),
          lastChecked: startTime,
        };
        services.push(errorResult);
        this.serviceHealthCache.set(serviceName, errorResult);
      }
    });

    // Determine overall health
    const unhealthyServices = services.filter(s => s.status === 'unhealthy');
    const degradedServices = services.filter(s => s.status === 'degraded');

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyServices.length > 0) {
      overall = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    // Generate alerts
    const alerts = this.generateAlerts(services);

    const healthStatus: HealthStatus = {
      overall,
      services,
      uptime: process.uptime(),
      timestamp: Date.now(),
      alerts,
      degradedServices: degradedServices.map(s => s.service),
      unhealthyServices: unhealthyServices.map(s => s.service),
    };

    this.lastHealthCheck = healthStatus;

    // Log health check results
    await this.logHealthCheck(healthStatus);

    return healthStatus;
  }

  /**
   * Check Redis health with latency measurement
   */
  private async checkRedisHealth(): Promise<HealthCheckResult> {
    if (!this.config.redis.enabled) {
      return {
        service: 'redis',
        status: 'healthy',
        timestamp: Date.now(),
        lastChecked: Date.now(),
        details: { disabled: true },
      };
    }

    const startTime = performance.now();

    try {
      const result = await testRedisConnection();
      const latency = performance.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (!result.connected) {
        status = 'unhealthy';
      } else if (latency > this.config.redis.unhealthyThreshold) {
        status = 'unhealthy';
      } else if (latency > this.config.redis.degradedThreshold) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        service: 'redis',
        status,
        latency,
        error: result.error,
        timestamp: Date.now(),
        lastChecked: startTime,
        details: {
          connected: result.connected,
          latency: `${latency.toFixed(2)}ms`,
          status: status === 'healthy' ? 'optimal' :
                  status === 'degraded' ? 'slow' : 'unhealthy',
        },
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        lastChecked: startTime,
      };
    }
  }

  /**
   * Check Clerk API health and response time
   */
  private async checkClerkHealth(): Promise<HealthCheckResult> {
    if (!this.config.clerk.enabled) {
      return {
        service: 'clerk',
        status: 'healthy',
        timestamp: Date.now(),
        lastChecked: Date.now(),
        details: { disabled: true },
      };
    }

    const startTime = performance.now();

    try {
      // Test Clerk API by attempting to get current user
      // This is a lightweight test that doesn't require authentication
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Clerk API timeout')), this.config.clerk.timeout);
      });

      const clerkTestPromise = (async () => {
        try {
          // Try to get current user (will be null in health check context)
          await currentUser();
          return { success: true };
        } catch (error) {
          // If we get an error, it might be due to no auth context, which is expected
          // We just want to test if Clerk API is reachable
          if (error instanceof Error && error.message.includes('auth')) {
            return { success: true, authError: true };
          }
          throw error;
        }
      })();

      await Promise.race([clerkTestPromise, timeoutPromise]);
      const latency = performance.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (latency > this.config.clerk.unhealthyThreshold) {
        status = 'unhealthy';
      } else if (latency > this.config.clerk.degradedThreshold) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        service: 'clerk',
        status,
        latency,
        timestamp: Date.now(),
        lastChecked: startTime,
        details: {
          latency: `${latency.toFixed(2)}ms`,
          status: status === 'healthy' ? 'responsive' :
                  status === 'degraded' ? 'slow' : 'unresponsive',
        },
      };
    } catch (error) {
      return {
        service: 'clerk',
        status: 'unhealthy',
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        lastChecked: startTime,
      };
    }
  }

  /**
   * Check database connection and query performance
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    if (!this.config.database.enabled) {
      return {
        service: 'database',
        status: 'healthy',
        timestamp: Date.now(),
        lastChecked: Date.now(),
        details: { disabled: true },
      };
    }

    const startTime = performance.now();

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database timeout')), this.config.database.timeout);
      });

      const dbTestPromise = (async () => {
        // Test database connection and perform a simple query
        const connection = await connectDB();
        const db = connection.connection.db;

        if (!db) {
          throw new Error('Database connection failed');
        }

        // Perform a simple query to test performance
        const collections = await db.collections();

        return {
          connected: true,
          collectionsCount: collections.length,
          databaseName: db.databaseName,
        };
      })();

      const result = await Promise.race([dbTestPromise, timeoutPromise]) as {
        connected: boolean;
        collectionsCount: number;
        databaseName: string;
      };
      const latency = performance.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (latency > this.config.database.unhealthyThreshold) {
        status = 'unhealthy';
      } else if (latency > this.config.database.degradedThreshold) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        service: 'database',
        status,
        latency,
        timestamp: Date.now(),
        lastChecked: startTime,
        details: {
          connected: result.connected,
          collectionsCount: result.collectionsCount,
          databaseName: result.databaseName,
          latency: `${latency.toFixed(2)}ms`,
          status: status === 'healthy' ? 'optimal' :
                  status === 'degraded' ? 'slow' : 'unhealthy',
        },
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        lastChecked: startTime,
      };
    }
  }

  /**
   * Check cache performance and hit ratios
   */
  private async checkCacheHealth(): Promise<HealthCheckResult> {
    if (!this.config.cache.enabled) {
      return {
        service: 'cache',
        status: 'healthy',
        timestamp: Date.now(),
        lastChecked: Date.now(),
        details: { disabled: true },
      };
    }

    const startTime = performance.now();

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Cache timeout')), this.config.cache.timeout);
      });

      const cacheTestPromise = (async () => {
        // Test cache operations and get metrics
        const metrics = await this.getCacheMetrics();

        // Test basic cache operations
        const testKey = `health_check_${Date.now()}`;
        await redis.setex(testKey, 10, 'test_value');
        const retrieved = await redis.get(testKey);
        await redis.del(testKey);

        return {
          operational: retrieved === 'test_value',
          metrics,
        };
      })();

      const result = await Promise.race([cacheTestPromise, timeoutPromise]) as {
        operational: boolean;
        metrics: CacheMetrics;
      };
      const latency = performance.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (!result.operational) {
        status = 'unhealthy';
      } else if (result.metrics.hitRatio < this.config.cache.minHitRatio) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        service: 'cache',
        status,
        latency,
        timestamp: Date.now(),
        lastChecked: startTime,
        details: {
          operational: result.operational,
          hitRatio: result.metrics.hitRatio,
          totalRequests: result.metrics.totalRequests,
          averageLatency: `${result.metrics.averageLatency.toFixed(2)}ms`,
          status: status === 'healthy' ? 'optimal' :
                  status === 'degraded' ? 'low_hit_ratio' : 'unhealthy',
        },
      };
    } catch (error) {
      return {
        service: 'cache',
        status: 'unhealthy',
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        lastChecked: startTime,
      };
    }
  }

  /**
   * Get cache performance metrics
   */
  private async getCacheMetrics(): Promise<CacheMetrics> {
    try {
      // Get cache statistics from Redis
      const date = new Date().toISOString().split('T')[0];
      const hits = await redis.get(`cache:hits:${date}`) || '0';
      const misses = await redis.get(`cache:misses:${date}`) || '0';
      const totalRequests = parseInt(hits as string) + parseInt(misses as string);
      const hitRatio = totalRequests > 0 ? parseInt(hits as string) / totalRequests : 0;

      // Get average latency (simplified - in production you'd track this)
      const avgLatency = await redis.get('cache:avg_latency') || '50';

      return {
        hits: parseInt(hits as string),
        misses: parseInt(misses as string),
        hitRatio,
        totalRequests,
        averageLatency: parseFloat(avgLatency as string),
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        hits: 0,
        misses: 0,
        hitRatio: 0,
        totalRequests: 0,
        averageLatency: 0,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Generate alerts based on health check results
   */
  private generateAlerts(services: HealthCheckResult[]): HealthAlert[] {
    const newAlerts: HealthAlert[] = [];

    for (const service of services) {
      const lastResult = this.serviceHealthCache.get(service.service);
      const alertKey = `${service.service}_${service.status}`;

      // Check if we need to generate an alert
      if (service.status !== 'healthy') {
        // Check cooldown period
        const lastAlert = this.alerts.get(alertKey);
        if (lastAlert && (Date.now() - lastAlert.timestamp) < this.config.alerting.alertCooldown) {
          continue;
        }

        const alert: HealthAlert = {
          id: `${alertKey}_${Date.now()}`,
          service: service.service,
          type: service.status as 'degraded' | 'unhealthy',
          message: `${service.service} is ${service.status}: ${service.error || 'No details'}`,
          timestamp: Date.now(),
          details: {
            latency: service.latency,
            error: service.error,
            details: service.details,
          },
        };

        newAlerts.push(alert);
        this.alerts.set(alertKey, alert);
      } else if (lastResult && lastResult.status !== 'healthy') {
        // Service recovered
        const recoveryAlert: HealthAlert = {
          id: `recovery_${service.service}_${Date.now()}`,
          service: service.service,
          type: 'recovered',
          message: `${service.service} has recovered`,
          timestamp: Date.now(),
          details: {
            previousStatus: lastResult.status,
            latency: service.latency,
          },
        };

        newAlerts.push(recoveryAlert);
      }
    }

    // Clean up old alerts
    if (this.alerts.size > this.config.alerting.maxAlerts) {
      const sortedAlerts = Array.from(this.alerts.entries())
        .sort(([, a], [, b]) => b.timestamp - a.timestamp);

      const alertsToRemove = sortedAlerts.slice(this.config.alerting.maxAlerts);
      alertsToRemove.forEach(([key]) => this.alerts.delete(key));
    }

    return newAlerts;
  }

  /**
   * Log health check results
   */
  private async logHealthCheck(healthStatus: HealthStatus): Promise<void> {
    try {
      await webhookLogger.log(
        healthStatus.overall === 'healthy' ? 'info' : 'warn',
        'health_check',
        `Health check completed: ${healthStatus.overall}`,
        {
          source: 'health-service',
          metadata: {
            overall: healthStatus.overall,
            services: healthStatus.services.map(s => ({
              service: s.service,
              status: s.status,
              latency: s.latency,
            })),
            degradedServices: healthStatus.degradedServices,
            unhealthyServices: healthStatus.unhealthyServices,
            alertsCount: healthStatus.alerts.length,
          },
        }
      );
    } catch (error) {
      console.error('Failed to log health check:', error);
    }
  }

  /**
   * Get current health status (cached)
   */
  getCurrentHealth(): HealthStatus | null {
    return this.lastHealthCheck;
  }

  /**
   * Get service-specific health
   */
  getServiceHealth(service: string): HealthCheckResult | null {
    return this.serviceHealthCache.get(service) || null;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const [cacheMetrics, redisInfo] = await Promise.all([
      this.getCacheMetrics(),
      this.getRedisInfo(),
    ]);

    return {
      redis: redisInfo,
      database: await this.getDatabaseMetrics(),
      clerk: await this.getClerkMetrics(),
      cache: cacheMetrics,
      timestamp: Date.now(),
    };
  }

  /**
   * Get Redis information
   */
  private async getRedisInfo(): Promise<PerformanceMetrics['redis']> {
    try {
      // Use a simple ping to test connectivity and measure latency
      const start = performance.now();
      await redis.ping();
      const latency = performance.now() - start;

      // Get basic connection info (simplified)
      return {
        latency,
        operationsPerSecond: 0, // Would need external monitoring
        memoryUsage: 0, // Would need external monitoring
        connections: 1, // Basic connection count
      };
    } catch (error) {
      return {
        latency: 0,
        operationsPerSecond: 0,
        memoryUsage: 0,
        connections: 0,
      };
    }
  }

  /**
   * Get database metrics
   */
  private async getDatabaseMetrics(): Promise<PerformanceMetrics['database']> {
    try {
      const connection = await connectDB();
      const db = connection.connection.db;

      if (!db) {
        return {
          latency: 0,
          activeConnections: 0,
          queryCount: 0,
          slowQueries: 0,
        };
      }

      // Get database stats
      const stats = await db.stats();

      return {
        latency: 0, // Would need to track this separately
        activeConnections: stats.objects || 0,
        queryCount: 0, // Would need to track this separately
        slowQueries: 0, // Would need to track this separately
      };
    } catch (error) {
      return {
        latency: 0,
        activeConnections: 0,
        queryCount: 0,
        slowQueries: 0,
      };
    }
  }

  /**
   * Get Clerk metrics
   */
  private async getClerkMetrics(): Promise<PerformanceMetrics['clerk']> {
    // Simplified metrics - in production you'd track these
    return {
      latency: 0,
      apiCalls: 0,
      errorRate: 0,
    };
  }

  /**
   * Start scheduled health checks
   */
  startScheduledChecks(intervalMs: number = 60000): void {
    // Stop existing intervals
    this.stopScheduledChecks();

    // Schedule health checks
    const interval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Scheduled health check failed:', error);
      }
    }, intervalMs);

    this.healthCheckIntervals.set('health-check', interval);
  }

  /**
   * Stop scheduled health checks
   */
  stopScheduledChecks(): void {
    this.healthCheckIntervals.forEach(interval => {
      clearInterval(interval);
    });
    this.healthCheckIntervals.clear();
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopScheduledChecks();
    this.alerts.clear();
    this.serviceHealthCache.clear();
  }
}

// Export singleton instance
export const healthCheckService = HealthCheckService.getInstance();