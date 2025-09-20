import { redis, testRedisConnection } from '@/lib/redis';
import { connectDB } from '@/lib/db/connection';
import { RedisCircuitBreaker } from '@/lib/redis/circuit-breaker';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  details?: Record<string, unknown>;
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
  details?: Record<string, unknown>;
}

export interface HealthCheckConfig {
  redis: {
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
    degradedThreshold: number; // ms
    unhealthyThreshold: number; // ms
  };
}

export interface PerformanceMetrics {
  redis: {
    latency: number;
    memoryUsage: number;
    connections: number;
    hitRate: number;
    commandsProcessed: number;
    errorRate: number;
  };
  database: {
    latency: number;
    connections: number;
    queryCount: number;
    slowQueries: number;
  };
  cache: {
    latency: number;
    hitRate: number;
    memoryUsage: number;
    operations: number;
  };
  timestamp: number;
}

export class HealthChecker {
  private config: HealthCheckConfig;
  private circuitBreaker: RedisCircuitBreaker;
  private readonly startTime = Date.now();
  private alerts: HealthAlert[] = [];

  constructor(config?: Partial<HealthCheckConfig>) {
    this.config = {
      redis: {
        enabled: true,
        timeout: 5000,
        degradedThreshold: 200,
        unhealthyThreshold: 1000,
        ...config?.redis,
      },
      database: {
        enabled: true,
        timeout: 10000,
        degradedThreshold: 500,
        unhealthyThreshold: 2000,
        ...config?.database,
      },
      cache: {
        enabled: true,
        timeout: 3000,
        degradedThreshold: 100,
        unhealthyThreshold: 500,
        ...config?.cache,
      },
    };

    this.circuitBreaker = new RedisCircuitBreaker();
  }

  /**
   * Perform comprehensive health check
   */
  async checkHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkRedisHealth(),
      this.checkDatabaseHealth(),
      this.checkCacheHealth(),
    ]);

    const services: HealthCheckResult[] = [];
    let degradedServices: string[] = [];
    let unhealthyServices: string[] = [];

    // Process results
    checks.forEach((result, index) => {
      const serviceNames = ['redis', 'database', 'cache'];
      const serviceName = serviceNames[index];

      if (result.status === 'fulfilled') {
        services.push(result.value);
        if (result.value.status === 'degraded') {
          degradedServices.push(serviceName);
        } else if (result.value.status === 'unhealthy') {
          unhealthyServices.push(serviceName);
        }
      } else {
        services.push({
          service: serviceName,
          status: 'unhealthy',
          error: result.reason.message,
          timestamp: Date.now(),
          lastChecked: Date.now(),
        });
        unhealthyServices.push(serviceName);
      }
    });

    // Determine overall status
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyServices.length > 0) {
      overall = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      services,
      uptime: Date.now() - this.startTime,
      timestamp: Date.now(),
      alerts: this.alerts,
      degradedServices,
      unhealthyServices,
    };
  }

  /**
   * Check Redis health and response time
   */
  private async checkRedisHealth(): Promise<HealthCheckResult> {
    if (!this.config.redis.enabled) {
      return {
        service: 'redis',
        status: 'healthy',
        timestamp: Date.now(),
        lastChecked: Date.now(),
        details: { enabled: false },
      };
    }

    const startTime = performance.now();
    try {
      // Test Redis connection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis timeout')), this.config.redis.timeout);
      });

      await Promise.race([testRedisConnection(), timeoutPromise]);
      const latency = performance.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (latency > this.config.redis.unhealthyThreshold) {
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
        timestamp: Date.now(),
        lastChecked: Date.now(),
        details: {
          connected: true,
          threshold: this.config.redis.degradedThreshold,
        },
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        lastChecked: Date.now(),
      };
    }
  }

  /**
   * Check database health and response time
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    if (!this.config.database.enabled) {
      return {
        service: 'database',
        status: 'healthy',
        timestamp: Date.now(),
        lastChecked: Date.now(),
        details: { enabled: false },
      };
    }

    const startTime = performance.now();
    try {
      // Test database connection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database timeout')), this.config.database.timeout);
      });

      await Promise.race([connectDB(), timeoutPromise]);
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
        lastChecked: Date.now(),
        details: {
          connected: true,
          threshold: this.config.database.degradedThreshold,
        },
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        lastChecked: Date.now(),
      };
    }
  }

  /**
   * Check cache health (Redis-based caching)
   */
  private async checkCacheHealth(): Promise<HealthCheckResult> {
    if (!this.config.cache.enabled) {
      return {
        service: 'cache',
        status: 'healthy',
        timestamp: Date.now(),
        lastChecked: Date.now(),
        details: { enabled: false },
      };
    }

    const startTime = performance.now();
    try {
      // Test cache operations
      const testKey = 'health-check-test';
      const testValue = Date.now().toString();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Cache timeout')), this.config.cache.timeout);
      });

      const cacheTestPromise = (async () => {
        await redis.set(testKey, testValue, 'EX', 10);
        const retrieved = await redis.get(testKey);
        await redis.del(testKey);

        if (retrieved !== testValue) {
          throw new Error('Cache read/write mismatch');
        }
      })();

      await Promise.race([cacheTestPromise, timeoutPromise]);
      const latency = performance.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (latency > this.config.cache.unhealthyThreshold) {
        status = 'unhealthy';
      } else if (latency > this.config.cache.degradedThreshold) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        service: 'cache',
        status,
        latency,
        timestamp: Date.now(),
        lastChecked: Date.now(),
        details: {
          connected: true,
          threshold: this.config.cache.degradedThreshold,
        },
      };
    } catch (error) {
      return {
        service: 'cache',
        status: 'unhealthy',
        latency: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        lastChecked: Date.now(),
      };
    }
  }

  /**
   * Get performance metrics for all services
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const redisInfo = await this.getRedisMetrics();

    return {
      redis: redisInfo,
      database: await this.getDatabaseMetrics(),
      cache: {
        latency: redisInfo.latency,
        hitRate: redisInfo.hitRate,
        memoryUsage: redisInfo.memoryUsage,
        operations: redisInfo.commandsProcessed,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Get Redis metrics
   */
  private async getRedisMetrics(): Promise<PerformanceMetrics['redis']> {
    try {
      const info = await redis.info('memory');
      const stats = await redis.info('stats');

      // Parse Redis info response
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memory = memoryMatch ? parseInt(memoryMatch[1], 10) : 0;

      const commandsMatch = stats.match(/total_commands_processed:(\d+)/);
      const commands = commandsMatch ? parseInt(commandsMatch[1], 10) : 0;

      return {
        latency: 0, // Would need to measure actual latency
        memoryUsage: memory,
        connections: 1, // Simplified
        hitRate: 95, // Would calculate from cache hit statistics
        commandsProcessed: commands,
        errorRate: 0, // Would track errors over time
      };
    } catch (error) {
      console.warn('[HealthCheck] Failed to get Redis metrics:', error);
      return {
        latency: 0,
        memoryUsage: 0,
        connections: 0,
        hitRate: 0,
        commandsProcessed: 0,
        errorRate: 100,
      };
    }
  }

  /**
   * Get database metrics
   */
  private async getDatabaseMetrics(): Promise<PerformanceMetrics['database']> {
    // Simplified metrics - in production you'd track these
    return {
      latency: 0,
      connections: 1,
      queryCount: 0,
      slowQueries: 0,
    };
  }
}

// Export singleton instance
export const healthChecker = new HealthChecker();