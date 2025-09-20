/**
 * Circuit Breaker Factory and Integration Layer
 *
 * Provides easy-to-use factory functions and integration utilities
 * for the persistent Redis-backed circuit breaker.
 */

import { Redis } from '@upstash/redis';
import {
  PersistentCircuitBreaker,
  PersistentCircuitBreakerConfig,
  CircuitBreakerError,
  CircuitState as _CircuitState,
  defaultCircuitBreakerConfig,
} from './persistent-circuit-breaker';

// Global circuit breaker registry for singleton instances
const circuitBreakerRegistry = new Map<string, PersistentCircuitBreaker>();

/**
 * Get or create a circuit breaker instance
 */
export function getCircuitBreaker(
  serviceName: string,
  redis: Redis,
  config?: Partial<PersistentCircuitBreakerConfig>,
): PersistentCircuitBreaker {
  const key = `${serviceName}:${redis.constructor.name}`;

  if (!circuitBreakerRegistry.has(key)) {
    const fullConfig = {
      ...defaultCircuitBreakerConfig,
      serviceName,
      ...config,
    };

    circuitBreakerRegistry.set(key, new PersistentCircuitBreaker(redis, fullConfig));
  }

  return circuitBreakerRegistry.get(key)!;
}

/**
 * Create a circuit breaker with default Redis configuration
 */
export function createCircuitBreaker(
  serviceName: string,
  config?: Partial<PersistentCircuitBreakerConfig>,
): PersistentCircuitBreaker {
  // Get Redis instance from environment
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    // During build time, environment variables might not be available
    // Throw error only if we're not in build mode
    if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
      console.warn('Redis environment variables not configured for circuit breaker - using fallback');
      // Return a mock circuit breaker for development/build
      return {
        execute: async <T>(operation: () => Promise<T>) => operation(),
        getHealth: async () => ({ status: 'healthy' as const }),
        getMetrics: async () => ({ 
          availability: 100,
          errorRate: 0,
          responseTime: 0,
          successCount: 0,
          errorCount: 0,
          totalRequests: 0,
          totalFailures: 0
        }),
        isAvailable: async () => true,
        reset: async () => {},
        forceOpen: async () => {},
        forceClose: async () => {},
      } as unknown as PersistentCircuitBreaker;
    }
    throw new Error('Redis environment variables not configured for circuit breaker');
  }

  const redis = new Redis({
    url: redisUrl,
    token: redisToken,
  });

  return getCircuitBreaker(serviceName, redis, config);
}

/**
 * Circuit breaker wrapper for Redis operations
 */
export class RedisCircuitBreakerWrapper {
  private circuitBreaker: PersistentCircuitBreaker;

  constructor(serviceName: string, config?: Partial<PersistentCircuitBreakerConfig>) {
    this.circuitBreaker = createCircuitBreaker(serviceName, config);
  }

  /**
   * Execute Redis operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>, operationName?: string): Promise<T> {
    return this.circuitBreaker.execute(operation, operationName);
  }

  /**
   * Get circuit breaker health status
   */
  async getHealth() {
    return this.circuitBreaker.getHealth();
  }

  /**
   * Get current metrics
   */
  async getMetrics() {
    return this.circuitBreaker.getMetrics();
  }

  /**
   * Check if circuit breaker is available
   */
  async isAvailable(): Promise<boolean> {
    return this.circuitBreaker.isAvailable();
  }

  /**
   * Manually reset the circuit breaker
   */
  async reset(): Promise<void> {
    return this.circuitBreaker.reset();
  }

  /**
   * Force circuit to open
   */
  async forceOpen(): Promise<void> {
    return this.circuitBreaker.forceOpen();
  }

  /**
   * Force circuit to close
   */
  async forceClose(): Promise<void> {
    return this.circuitBreaker.forceClose();
  }
}

/**
 * Pre-configured circuit breakers for common services - lazy loaded
 */
let _circuitBreakers: {
  redis?: RedisCircuitBreakerWrapper;
  database?: RedisCircuitBreakerWrapper;
  api?: RedisCircuitBreakerWrapper;
  auth?: RedisCircuitBreakerWrapper;
} = {};

export const CircuitBreakers = {
  // Redis operations circuit breaker - lazy loaded
  get redis() {
    if (!_circuitBreakers.redis) {
      _circuitBreakers.redis = new RedisCircuitBreakerWrapper('redis-service', {
        failureThreshold: 5,
        successThreshold: 3,
        recoveryTimeout: 30000,
        maxRecoveryTimeout: 300000,
        monitoringPeriod: 300000,
      });
    }
    return _circuitBreakers.redis;
  },

  // Database operations circuit breaker - lazy loaded
  get database() {
    if (!_circuitBreakers.database) {
      _circuitBreakers.database = new RedisCircuitBreakerWrapper('database-service', {
        failureThreshold: 3,
        successThreshold: 2,
        recoveryTimeout: 15000,
        maxRecoveryTimeout: 120000,
        monitoringPeriod: 180000,
      });
    }
    return _circuitBreakers.database;
  },

  // External API calls circuit breaker - lazy loaded
  get api() {
    if (!_circuitBreakers.api) {
      _circuitBreakers.api = new RedisCircuitBreakerWrapper('external-api', {
        failureThreshold: 10,
        successThreshold: 5,
        recoveryTimeout: 60000,
        maxRecoveryTimeout: 600000,
        monitoringPeriod: 600000,
      });
    }
    return _circuitBreakers.api;
  },

  // Authentication service circuit breaker - lazy loaded
  get auth() {
    if (!_circuitBreakers.auth) {
      _circuitBreakers.auth = new RedisCircuitBreakerWrapper('auth-service', {
        failureThreshold: 3,
        successThreshold: 2,
        recoveryTimeout: 10000,
        maxRecoveryTimeout: 60000,
        monitoringPeriod: 120000,
      });
    }
    return _circuitBreakers.auth;
  },
};

/**
 * Circuit breaker middleware for Next.js API routes
 */
export function withCircuitBreaker(
  handler: (req: Request, context?: unknown) => Promise<Response>,
  serviceName: string = 'api-route',
  config?: Partial<PersistentCircuitBreakerConfig>,
) {
  const circuitBreaker = createCircuitBreaker(serviceName, config);

  return async (req: Request, context?: unknown): Promise<Response> => {
    try {
      // Check if circuit breaker allows the request
      const isAvailable = await circuitBreaker.isAvailable();
      if (!isAvailable) {
        return new Response(
          JSON.stringify({
            error: 'Service temporarily unavailable',
            retryAfter: 60,
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
            },
          },
        );
      }

      // Execute the handler with circuit breaker protection
      const result = await circuitBreaker.execute(
        () => handler(req, context),
        `${req.method} ${new URL(req.url).pathname}`,
      );

      return result;
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        return new Response(
          JSON.stringify({
            error: error.message,
            code: error.code,
            details: error.details,
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
            },
          },
        );
      }

      // Re-throw other errors
      throw error;
    }
  };
}

/**
 * Circuit breaker hook for React components (client-side)
 */
export function useCircuitBreaker(_serviceName: string) {
  // Client-side circuit breaker status (limited functionality)
  return {
    isAvailable: true, // Assume available on client
    getHealth: async () => ({ status: 'healthy' as const }),
    execute: async <T>(operation: () => Promise<T>) => operation(),
  };
}

/**
 * Health check endpoint for circuit breakers
 */
export async function getCircuitBreakerHealth(): Promise<{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, unknown>;
  timestamp: number;
}> {
  const services = ['redis', 'database', 'api', 'auth'] as const;
  const healthChecks = await Promise.allSettled(
    services.map(async (service) => {
      try {
        const health = await CircuitBreakers[service].getHealth();
        return { service, health };
      } catch (error) {
        return {
          service,
          health: {
            status: 'unhealthy' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    }),
  );

  const serviceHealth = healthChecks.reduce(
    (acc, result) => {
      if (result.status === 'fulfilled') {
        acc[result.value.service] = result.value.health;
      } else {
        acc.unknown = { status: 'unhealthy', error: result.reason };
      }
      return acc;
    },
    {} as Record<string, unknown>,
  );

  // Determine overall health
  const unhealthyCount = Object.values(serviceHealth).filter(
    (h) => (h as { status?: string })?.status === 'unhealthy',
  ).length;

  const degradedCount = Object.values(serviceHealth).filter(
    (h) => (h as { status?: string })?.status === 'degraded',
  ).length;

  let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (unhealthyCount > 0) {
    overall = 'unhealthy';
  } else if (degradedCount > 0) {
    overall = 'degraded';
  }

  return {
    overall,
    services: serviceHealth,
    timestamp: Date.now(),
  };
}

/**
 * Circuit breaker monitoring utilities
 */
export const CircuitBreakerMonitoring = {
  /**
   * Get all circuit breaker metrics
   */
  async getAllMetrics() {
    const services = ['redis', 'database', 'api', 'auth'] as const;
    const metrics = await Promise.allSettled(
      services.map(async (service) => {
        try {
          const metrics = await CircuitBreakers[service].getMetrics();
          return { service, metrics };
        } catch (error) {
          return {
            service,
            metrics: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
    );

    return metrics.reduce(
      (acc, result) => {
        if (result.status === 'fulfilled') {
          acc[result.value.service] = result.value;
        } else {
          acc.unknown = { error: result.reason };
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );
  },

  /**
   * Reset all circuit breakers
   */
  async resetAll() {
    const services = ['redis', 'database', 'api', 'auth'] as const;
    const results = await Promise.allSettled(
      services.map(async (service) => {
        try {
          await CircuitBreakers[service].reset();
          return { service, success: true };
        } catch (error) {
          return {
            service,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
    );

    return results.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return { service: 'unknown', success: false, error: result.reason };
      }
    });
  },

  /**
   * Get circuit breaker alerts
   */
  async getAlerts() {
    const metrics = await this.getAllMetrics();
    const alerts: Array<{
      service: string;
      type: 'warning' | 'error' | 'info';
      message: string;
      timestamp: number;
    }> = [];

    Object.entries(metrics).forEach(([service, data]) => {
      if ((data as { error?: string }).error) {
        alerts.push({
          service,
          type: 'error',
          message: `Circuit breaker error: ${(data as { error: string }).error}`,
          timestamp: Date.now(),
        });
      } else if ((data as { metrics?: { availability: number; errorRate: number; responseTime: number; successCount: number; errorCount: number; totalRequests: number; totalFailures: number } }).metrics) {
        const m = (data as { metrics: { availability: number; errorRate: number; responseTime: number; successCount: number; errorCount: number; totalRequests: number; totalFailures: number } }).metrics;

        // Check availability
        if (m.availability < 90) {
          alerts.push({
            service,
            type: 'error',
            message: `Low availability: ${m.availability.toFixed(1)}%`,
            timestamp: Date.now(),
          });
        } else if (m.availability < 95) {
          alerts.push({
            service,
            type: 'warning',
            message: `Degraded availability: ${m.availability.toFixed(1)}%`,
            timestamp: Date.now(),
          });
        }

        // Check failure rate
        const failureRate = m.totalRequests > 0 ? (m.totalFailures / m.totalRequests) * 100 : 0;
        if (failureRate > 20) {
          alerts.push({
            service,
            type: 'warning',
            message: `High failure rate: ${failureRate.toFixed(1)}%`,
            timestamp: Date.now(),
          });
        }
      }
    });

    return alerts;
  },
};

// Export types for external use
export type {
  PersistentCircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerMetrics,
} from './persistent-circuit-breaker';

// Re-export main classes
export {
  PersistentCircuitBreaker,
  CircuitBreakerError,
  CircuitState,
} from './persistent-circuit-breaker';
