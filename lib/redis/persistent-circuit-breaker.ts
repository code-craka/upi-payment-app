/**
 * Persistent Redis-Backed Circuit Breaker for Serverless Functions
 *
 * Features:
 * - Redis-backed state storage with TTL for cross-instance coordination
 * - Exponential backoff with jitter for recovery attempts
 * - Comprehensive monitoring and metrics collection
 * - Edge Runtime compatible with Upstash Redis REST API
 * - Graceful degradation when Redis is unavailable
 * - Configurable thresholds and timeouts
 * - Atomic state transitions using Lua scripts
 */

import { Redis } from '@upstash/redis';

// Circuit Breaker States
export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

// Circuit Breaker Configuration
export interface PersistentCircuitBreakerConfig {
  // Failure thresholds
  failureThreshold: number; // Failures before opening circuit
  successThreshold: number; // Successes needed in half-open state

  // Timeouts
  recoveryTimeout: number; // Base time before recovery attempt (ms)
  maxRecoveryTimeout: number; // Maximum recovery timeout (ms)
  monitoringPeriod: number; // Time window for failure tracking (ms)

  // Exponential backoff
  backoffMultiplier: number; // Multiplier for exponential backoff
  backoffJitter: number; // Jitter factor (0-1)

  // Redis configuration
  stateTtl: number; // TTL for circuit state in Redis (ms)
  metricsTtl: number; // TTL for metrics in Redis (ms)

  // Service identification
  serviceName: string; // Name of the service being protected
  instanceId?: string; // Optional instance identifier
}

// Circuit Breaker State Data
export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  lastStateChange: number;
  recoveryAttempts: number;
  consecutiveSuccesses: number;
  consecutiveFailures: number;
}

// Monitoring Metrics
export interface CircuitBreakerMetrics {
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  totalTimeouts: number;
  stateChanges: number;
  recoveryAttempts: number;
  lastResetTime: number;
  uptime: number;
  availability: number; // Percentage
}

// Default Configuration
const DEFAULT_CONFIG: PersistentCircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds
  maxRecoveryTimeout: 300000, // 5 minutes
  monitoringPeriod: 300000, // 5 minutes
  backoffMultiplier: 2,
  backoffJitter: 0.1,
  stateTtl: 600000, // 10 minutes
  metricsTtl: 86400000, // 24 hours
  serviceName: 'redis-service',
};

// Redis Keys
const getStateKey = (serviceName: string) => `circuit_breaker:state:${serviceName}`;
const getMetricsKey = (serviceName: string) => `circuit_breaker:metrics:${serviceName}`;
const getLockKey = (serviceName: string) => `circuit_breaker:lock:${serviceName}`;

/**
 * Safe JSON parse utility with fallback and error handling
 */
function safeParse<T>(input: string, fallback: T): T {
  try {
    if (!input || typeof input !== 'string') {
      console.warn('[CircuitBreaker] Invalid input for JSON parsing, using fallback');
      return fallback;
    }

    // Check for common invalid JSON patterns
    if (input.trim() === '' || input === '[object Object]' || input === 'undefined' || input === 'null') {
      console.warn('[CircuitBreaker] Detected invalid JSON pattern, using fallback:', input.substring(0, 50));
      return fallback;
    }

    const parsed = JSON.parse(input) as T;
    return parsed;
  } catch (error) {
    console.warn('[CircuitBreaker] JSON parse failed, using fallback:', error);
    return fallback;
  }
}

/**
 * Get default circuit breaker state
 */
function getDefaultState(): CircuitBreakerState {
  return {
    state: CircuitState.CLOSED,
    failures: 0,
    successes: 0,
    lastFailureTime: null,
    lastSuccessTime: null,
    lastStateChange: Date.now(),
    recoveryAttempts: 0,
    consecutiveSuccesses: 0,
    consecutiveFailures: 0,
  };
}

/**
 * Persistent Redis-Backed Circuit Breaker
 */
export class PersistentCircuitBreaker {
  private config: PersistentCircuitBreakerConfig;
  private redis: Redis;
  private stateCache: Map<string, { data: CircuitBreakerState; expires: number }> = new Map();
  private metricsCache: Map<string, { data: CircuitBreakerMetrics; expires: number }> = new Map();

  constructor(redis: Redis, config: Partial<PersistentCircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.redis = redis;

    // Generate instance ID if not provided
    if (!this.config.instanceId) {
      this.config.instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>, operationName?: string): Promise<T> {
    const startTime = Date.now();

    try {
      // Get current state
      const state = await this.getState();
      
      // Update last known state for sync access
      this.lastKnownState = state.state;

      // Check if circuit should allow the operation
      if (!this.shouldAllowRequest(state)) {
        await this.recordTimeout(operationName);
        throw new CircuitBreakerError(
          'Circuit breaker is OPEN',
          CircuitBreakerError.CODE_CIRCUIT_OPEN,
          { state: state.state, lastFailureTime: state.lastFailureTime },
        );
      }

      // Execute the operation
      const result = await operation();

      // Record success
      await this.recordSuccess(operationName, Date.now() - startTime);

      return result;
    } catch (error) {
      // Record failure (but not for circuit breaker errors)
      if (!(error instanceof CircuitBreakerError)) {
        await this.recordFailure(operationName, Date.now() - startTime, error as Error);
      }

      throw error;
    }
  }

  /**
   * Get current circuit breaker state from Redis
   */
  private async getState(): Promise<CircuitBreakerState> {
    try {
      const stateKey = getStateKey(this.config.serviceName);
      const cached = this.stateCache.get(stateKey);

      // Check local cache first
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }

      // Fetch from Redis
      const stateData = await this.redis.get(stateKey);

      if (!stateData) {
        // Initialize default state
        const defaultState: CircuitBreakerState = {
          state: CircuitState.CLOSED,
          failures: 0,
          successes: 0,
          lastFailureTime: null,
          lastSuccessTime: null,
          lastStateChange: Date.now(),
          recoveryAttempts: 0,
          consecutiveSuccesses: 0,
          consecutiveFailures: 0,
        };

        await this.setState(defaultState);
        return defaultState;
      }

      const state = JSON.parse(stateData as string) as CircuitBreakerState;

      // Update state cache
      this.stateCache.set(stateKey, {
        data: state,
        expires: Date.now() + 5000, // 5 second local cache
      });

      return state;
    } catch (parseError) {
      console.warn('[CircuitBreaker] Failed to parse state from Redis, clearing corrupted data:', parseError);

      // Clear corrupted data and return default state
      try {
        const stateKey = getStateKey(this.config.serviceName);
        await this.redis.del(stateKey);
      } catch (delError) {
        console.error('[CircuitBreaker] Failed to clear corrupted state:', delError);
      }

      // Return default state
      const defaultState: CircuitBreakerState = {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        lastStateChange: Date.now(),
        recoveryAttempts: 0,
        consecutiveSuccesses: 0,
        consecutiveFailures: 0,
      };

      return defaultState;
    }
  }

  /**
   * Set circuit breaker state in Redis atomically
   */
  private async setState(newState: CircuitBreakerState): Promise<void> {
    try {
      const stateKey = getStateKey(this.config.serviceName);
      const stateData = JSON.stringify(newState);

      // Use SET with TTL for atomic operation
      await this.redis.setex(stateKey, Math.ceil(this.config.stateTtl / 1000), stateData);

      // Update state cache
      this.stateCache.set(stateKey, {
        data: newState,
        expires: Date.now() + 5000,
      });
    } catch (error) {
      console.error('[CircuitBreaker] Failed to set state in Redis:', error);
      // Continue with local state only
    }
  }

  /**
   * Check if request should be allowed based on current state
   */
  private shouldAllowRequest(state: CircuitBreakerState): boolean {
    switch (state.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        return this.shouldAttemptRecovery(state);

      case CircuitState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Check if circuit should attempt recovery
   */
  private shouldAttemptRecovery(state: CircuitBreakerState): boolean {
    if (state.state !== CircuitState.OPEN || !state.lastFailureTime) {
      return false;
    }

    const timeSinceLastFailure = Date.now() - state.lastFailureTime;
    const recoveryTimeout = this.calculateRecoveryTimeout(state.recoveryAttempts);

    return timeSinceLastFailure >= recoveryTimeout;
  }

  /**
   * Calculate recovery timeout with exponential backoff and jitter
   */
  private calculateRecoveryTimeout(recoveryAttempts: number): number {
    const baseTimeout = this.config.recoveryTimeout;
    const multiplier = Math.pow(this.config.backoffMultiplier, recoveryAttempts);
    const backoffTimeout = baseTimeout * multiplier;

    // Apply maximum timeout limit
    const cappedTimeout = Math.min(backoffTimeout, this.config.maxRecoveryTimeout);

    // Add jitter to prevent thundering herd
    const jitter = cappedTimeout * this.config.backoffJitter * (Math.random() - 0.5) * 2;
    const finalTimeout = Math.max(cappedTimeout + jitter, baseTimeout);

    return Math.floor(finalTimeout);
  }

  /**
   * Record successful operation
   */
  private async recordSuccess(operationName?: string, latency?: number): Promise<void> {
    try {
      await this.updateStateWithScript('success', operationName, latency);
      await this.updateMetrics('success', latency);
    } catch (error) {
      console.error('[CircuitBreaker] Failed to record success:', error);
    }
  }

  /**
   * Record failed operation
   */
  private async recordFailure(
    operationName?: string,
    latency?: number,
    error?: Error,
  ): Promise<void> {
    try {
      await this.updateStateWithScript('failure', operationName, latency, error);
      await this.updateMetrics('failure', latency);
    } catch (recordError) {
      console.error('[CircuitBreaker] Failed to record failure:', recordError);
    }
  }

  /**
   * Record timeout
   */
  private async recordTimeout(_operationName?: string): Promise<void> {
    try {
      await this.updateMetrics('timeout');
    } catch (error) {
      console.error('[CircuitBreaker] Failed to record timeout:', error);
    }
  }

  /**
   * Update circuit breaker state using Lua script for atomicity
   */
  private async updateStateWithScript(
    type: 'success' | 'failure',
    _operationName?: string,
    _latency?: number,
    _error?: Error,
  ): Promise<void> {
    const stateKey = getStateKey(this.config.serviceName);
    const lockKey = getLockKey(this.config.serviceName);

    // Lua script for atomic state updates
    const luaScript = `
      local state_key = KEYS[1]
      local lock_key = KEYS[2]
      local update_type = ARGV[1]
      local current_time = tonumber(ARGV[2])
      local failure_threshold = tonumber(ARGV[3])
      local success_threshold = tonumber(ARGV[4])

      -- Try to acquire lock (non-blocking)
      if redis.call('exists', lock_key) == 1 then
        return redis.call('get', state_key)
      end

      -- Set lock with short TTL
      redis.call('setex', lock_key, 5, 'locked')

      -- Get current state
      local state_data = redis.call('get', state_key)
      local state
      if state_data then
        state = cjson.decode(state_data)
      else
        state = {
          ["state"] = "CLOSED",
          ["failures"] = 0,
          ["successes"] = 0,
          ["lastFailureTime"] = nil,
          ["lastSuccessTime"] = nil,
          ["lastStateChange"] = current_time,
          ["recoveryAttempts"] = 0,
          ["consecutiveSuccesses"] = 0,
          ["consecutiveFailures"] = 0
        }
      end

      -- Update based on operation result
      if update_type == 'success' then
        state["successes"] = state["successes"] + 1
        state["consecutiveSuccesses"] = state["consecutiveSuccesses"] + 1
        state["consecutiveFailures"] = 0
        state["lastSuccessTime"] = current_time

        -- Check if should close circuit from half-open
        if state["state"] == 'HALF_OPEN' and state["consecutiveSuccesses"] >= success_threshold then
          state["state"] = 'CLOSED'
          state["failures"] = 0
          state["recoveryAttempts"] = 0
          state["lastStateChange"] = current_time
        end

      elseif update_type == 'failure' then
        state["failures"] = state["failures"] + 1
        state["consecutiveFailures"] = state["consecutiveFailures"] + 1
        state["consecutiveSuccesses"] = 0
        state["lastFailureTime"] = current_time

        -- Check if should open circuit
        if state["state"] == 'CLOSED' and state["consecutiveFailures"] >= failure_threshold then
          state["state"] = 'OPEN'
          state["lastStateChange"] = current_time
        elseif state["state"] == 'HALF_OPEN' then
          state["state"] = 'OPEN'
          state["recoveryAttempts"] = state["recoveryAttempts"] + 1
          state["lastStateChange"] = current_time
        end
      end

      -- Save updated state
      redis.call('setex', state_key, 600, cjson.encode(state))

      -- Release lock
      redis.call('del', lock_key)

      return cjson.encode(state)
    `;

    try {
      const result = await this.redis.eval(
        luaScript,
        [stateKey, lockKey],
        [
          type,
          Date.now().toString(),
          this.config.failureThreshold.toString(),
          this.config.successThreshold.toString(),
        ],
      );

      // Update local cache
      if (result) {
        const updatedState = JSON.parse(result as string);
        this.localCache.set(stateKey, {
          data: updatedState,
          expires: Date.now() + 5000,
        });
      }
    } catch (error) {
      console.error('[CircuitBreaker] Lua script execution failed:', error);
      // Fallback to simple state update
      await this.fallbackStateUpdate(type);
    }
  }

  /**
   * Fallback state update when Lua script fails
   */
  private async fallbackStateUpdate(type: 'success' | 'failure'): Promise<void> {
    try {
      const currentState = await this.getState();
      const now = Date.now();

      if (type === 'success') {
        currentState.successes++;
        currentState.consecutiveSuccesses++;
        currentState.consecutiveFailures = 0;
        currentState.lastSuccessTime = now;

        if (
          currentState.state === CircuitState.HALF_OPEN &&
          currentState.consecutiveSuccesses >= this.config.successThreshold
        ) {
          currentState.state = CircuitState.CLOSED;
          currentState.failures = 0;
          currentState.recoveryAttempts = 0;
          currentState.lastStateChange = now;
        }
      } else {
        currentState.failures++;
        currentState.consecutiveFailures++;
        currentState.consecutiveSuccesses = 0;
        currentState.lastFailureTime = now;

        if (
          currentState.state === CircuitState.CLOSED &&
          currentState.consecutiveFailures >= this.config.failureThreshold
        ) {
          currentState.state = CircuitState.OPEN;
          currentState.lastStateChange = now;
        } else if (currentState.state === CircuitState.HALF_OPEN) {
          currentState.state = CircuitState.OPEN;
          currentState.recoveryAttempts++;
          currentState.lastStateChange = now;
        }
      }

      await this.setState(currentState);
    } catch (error) {
      console.error('[CircuitBreaker] Fallback state update failed:', error);
    }
  }

  /**
   * Update monitoring metrics
   */
  private async updateMetrics(
    type: 'success' | 'failure' | 'timeout',
    latency?: number,
  ): Promise<void> {
    try {
      const metricsKey = getMetricsKey(this.config.serviceName);

      // Lua script for atomic metrics updates
      const luaScript = `
        local metrics_key = KEYS[1]
        local update_type = ARGV[1]
        local current_time = tonumber(ARGV[2])

        -- Get current metrics
        local metrics_data = redis.call('get', metrics_key)
        local metrics
        if metrics_data then
          metrics = cjson.decode(metrics_data)
        else
          metrics = {
            ["totalRequests"] = 0,
            ["totalFailures"] = 0,
            ["totalSuccesses"] = 0,
            ["totalTimeouts"] = 0,
            ["stateChanges"] = 0,
            ["recoveryAttempts"] = 0,
            ["lastResetTime"] = current_time,
            ["uptime"] = 0,
            ["availability"] = 100
          }
        end

        -- Update metrics
        metrics["totalRequests"] = metrics["totalRequests"] + 1

        if update_type == 'success' then
          metrics["totalSuccesses"] = metrics["totalSuccesses"] + 1
        elseif update_type == 'failure' then
          metrics["totalFailures"] = metrics["totalFailures"] + 1
        elseif update_type == 'timeout' then
          metrics["totalTimeouts"] = metrics["totalTimeouts"] + 1
        end

        -- Calculate availability
        if metrics["totalRequests"] > 0 then
          metrics["availability"] = (metrics["totalSuccesses"] / metrics["totalRequests"]) * 100
        end

        -- Save updated metrics
        redis.call('setex', metrics_key, 86400, cjson.encode(metrics))

        return cjson.encode(metrics)
      `;

      await this.redis.eval(luaScript, [metricsKey], [type, Date.now().toString()]);
    } catch (error) {
      console.error('[CircuitBreaker] Failed to update metrics:', error);
    }
  }

  /**
   * Get current metrics
   */
  async getMetrics(): Promise<CircuitBreakerMetrics> {
    try {
      const metricsKey = getMetricsKey(this.config.serviceName);
      const metricsData = await this.redis.get(metricsKey);

      if (!metricsData) {
        return {
          totalRequests: 0,
          totalFailures: 0,
          totalSuccesses: 0,
          totalTimeouts: 0,
          stateChanges: 0,
          recoveryAttempts: 0,
          lastResetTime: Date.now(),
          uptime: 0,
          availability: 100,
        };
      }

      return JSON.parse(metricsData as string) as CircuitBreakerMetrics;
    } catch (error) {
      console.error('[CircuitBreaker] Failed to get metrics:', error);
      return {
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        totalTimeouts: 0,
        stateChanges: 0,
        recoveryAttempts: 0,
        lastResetTime: Date.now(),
        uptime: 0,
        availability: 100,
      };
    }
  }

  /**
   * Get current state
   */
  async getCurrentState(): Promise<CircuitBreakerState> {
    return this.getState();
  }

  /**
   * Manually reset the circuit breaker
   */
  async reset(): Promise<void> {
    const resetState: CircuitBreakerState = {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      lastStateChange: Date.now(),
      recoveryAttempts: 0,
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
    };

    await this.setState(resetState);

    // Reset metrics
    try {
      const metricsKey = getMetricsKey(this.config.serviceName);
      await this.redis.del(metricsKey);
    } catch (error) {
      console.error('[CircuitBreaker] Failed to reset metrics:', error);
    }

    console.warn(`[CircuitBreaker:${this.config.serviceName}] Circuit breaker reset`);
  }

  /**
   * Force circuit to open
   */
  async forceOpen(): Promise<void> {
    const currentState = await this.getState();
    currentState.state = CircuitState.OPEN;
    currentState.lastStateChange = Date.now();

    await this.setState(currentState);
    console.warn(`[CircuitBreaker:${this.config.serviceName}] Circuit forced OPEN`);
  }

  /**
   * Force circuit to close
   */
  async forceClose(): Promise<void> {
    const currentState = await this.getState();
    currentState.state = CircuitState.CLOSED;
    currentState.failures = 0;
    currentState.consecutiveFailures = 0;
    currentState.lastStateChange = Date.now();

    await this.setState(currentState);
    console.warn(`[CircuitBreaker:${this.config.serviceName}] Circuit forced CLOSED`);
  }

  /**
   * Check if circuit is available
   */
  async isAvailable(): Promise<boolean> {
    const state = await this.getState();
    return this.shouldAllowRequest(state);
  }

  /**
   * Get circuit breaker health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    state: CircuitState;
    metrics: CircuitBreakerMetrics;
    lastUpdated: number;
  }> {
    const state = await this.getState();
    const metrics = await this.getMetrics();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (state.state === CircuitState.OPEN) {
      status = 'unhealthy';
    } else if (metrics.availability < 95) {
      status = 'degraded';
    }

    return {
      status,
      state: state.state,
      metrics,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get current state as string (for test compatibility)
   * @deprecated Use getCurrentState() instead
   */
  getStateSync(): CircuitState {
    // This is a synchronous method for backward compatibility with tests
    // In real usage, use getCurrentState() which is async and more reliable
    return this.lastKnownState || CircuitState.CLOSED;
  }

  /**
   * Get status information (for test compatibility)
   */
  async getStatus(): Promise<{
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailure?: number | null;
    lastSuccess?: number | null;
    uptime: number;
    availability: number;
  }> {
    const state = await this.getState();
    const metrics = await this.getMetrics();
    
    return {
      state: state.state,
      failures: state.failures,
      successes: state.successes,
      lastFailure: state.lastFailureTime,
      lastSuccess: state.lastSuccessTime,
      uptime: metrics?.uptime || 0,
      availability: metrics?.availability || 100,
    };
  }

  private lastKnownState: CircuitState = CircuitState.CLOSED;

  private async updateLastKnownState(): Promise<void> {
    try {
      const state = await this.getState();
      this.lastKnownState = state.state;
    } catch {
      // Keep the last known state if we can't fetch current state
    }
  }
}

/**
 * Circuit Breaker Error Class
 */
export class CircuitBreakerError extends Error {
  static readonly CODE_CIRCUIT_OPEN = 'CIRCUIT_OPEN';
  static readonly CODE_SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE';

  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.code = code;
    this.details = details;
  }
}

// Export default configuration
export { DEFAULT_CONFIG as defaultCircuitBreakerConfig };
