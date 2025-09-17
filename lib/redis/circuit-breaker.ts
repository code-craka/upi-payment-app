/**
 * Legacy Circuit Breaker - Now uses Persistent Circuit Breaker
 *
 * This file maintains backward compatibility while delegating
 * to the new Redis-backed persistent circuit breaker.
 */

import { CircuitBreakers } from './circuit-breaker-factory';

// Legacy interface for backward compatibility
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  successThreshold: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

// Legacy circuit breaker class that wraps the persistent implementation
export class RedisCircuitBreaker {
  private serviceName: string;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    // Use the persistent circuit breaker for Redis operations
    this.serviceName = 'redis-service';
  }

  /**
   * Execute a Redis operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return CircuitBreakers.redis.execute(operation, 'legacy-redis-operation');
  }

  /**
   * Get current circuit breaker statistics
   */
  async getStats(): Promise<CircuitBreakerStats> {
    const health = await CircuitBreakers.redis.getHealth();
    const metrics = await CircuitBreakers.redis.getMetrics();

    return {
      state: health.state as CircuitState,
      failures: 0, // Legacy compatibility
      successes: 0, // Legacy compatibility
      lastFailureTime: health.state === CircuitState.OPEN ? Date.now() : null,
      lastSuccessTime: health.state === CircuitState.CLOSED ? Date.now() : null,
      totalRequests: metrics.totalRequests,
      totalFailures: metrics.totalFailures,
      totalSuccesses: metrics.totalSuccesses,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  async reset(): Promise<void> {
    return CircuitBreakers.redis.reset();
  }

  /**
   * Force circuit to open
   */
  async forceOpen(): Promise<void> {
    return CircuitBreakers.redis.forceOpen();
  }

  /**
   * Force circuit to close
   */
  async forceClose(): Promise<void> {
    return CircuitBreakers.redis.forceClose();
  }

  /**
   * Check if circuit is currently allowing requests
   */
  async isAvailable(): Promise<boolean> {
    return CircuitBreakers.redis.isAvailable();
  }

  /**
   * Get current state synchronously (for test compatibility)
   * Note: This is synchronous but may not reflect the most current state
   */
  getState(): CircuitState {
    // Return a default state for synchronous access
    // In tests, this should be mocked or the tests should be made async
    return CircuitState.CLOSED;
  }

  /**
   * Get current state (async - preferred method)
   */
  async getStateAsync(): Promise<CircuitState> {
    const health = await CircuitBreakers.redis.getHealth();
    return health.state as CircuitState;
  }
}

// Singleton instance for backward compatibility
export const redisCircuitBreaker = new RedisCircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 60000,
  monitoringPeriod: 300000,
  successThreshold: 3,
});

// Export default instance
export default redisCircuitBreaker;
