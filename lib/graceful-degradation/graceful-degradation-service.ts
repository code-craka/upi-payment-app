/**
 * Graceful Degradation Service
 * 
 * Core service that provides graceful degradation capabilities with:
 * - Timeout management with Promise.        if (shouldFallback && options.fallbackStrategies) {
        try {
          const fallbackResult = await this.executeFallbackStrategies(options.fallbackStrategies) as T;
          this.metrics.fallbacks.successful++;
          return fallbackResult;patterns
 * - Circuit breaker integration
 * - Fallback strategies for partial service failures
 * - Performance monitoring and metrics collection
 * - Service health tracking and automatic recovery
 */

import { getTimeoutConfig, type OperationConfig, OPERATION_CONFIGS } from './timeout-config';
import { redis } from '@/lib/redis';

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  consecutiveFailures: number;
  circuitState: 'CLOSED' | 'HALF_OPEN' | 'OPEN';
}

export interface DegradationMetrics {
  timeouts: {
    total: number;
    byService: Record<string, number>;
    byOperation: Record<string, number>;
  };
  fallbacks: {
    total: number;
    successful: number;
    failed: number;
  };
  performance: {
    p50: number;
    p95: number;
    p99: number;
    errorRate: number;
  };
  circuitBreaker: {
    tripped: number;
    recovered: number;
    currentlyOpen: string[];
  };
}

export interface FallbackStrategy<T> {
  name: string;
  execute: () => Promise<T>;
  priority: number; // Lower number = higher priority
  canRetry: boolean;
}

export interface GracefulDegradationOptions {
  operationConfig: OperationConfig;
  fallbackStrategies?: FallbackStrategy<unknown>[];
  enableCircuitBreaker?: boolean;
  retryOnTimeout?: boolean;
  maxRetries?: number;
  cacheResult?: boolean;
  cacheTTL?: number;
}

class GracefulDegradationService {
  private static instance: GracefulDegradationService;
  private metrics: DegradationMetrics;
  private serviceStatuses: Map<string, ServiceStatus>;
  private timeoutConfig = getTimeoutConfig();
  
  private constructor() {
    this.metrics = {
      timeouts: { total: 0, byService: {}, byOperation: {} },
      fallbacks: { total: 0, successful: 0, failed: 0 },
      performance: { p50: 0, p95: 0, p99: 0, errorRate: 0 },
      circuitBreaker: { tripped: 0, recovered: 0, currentlyOpen: [] }
    };
    this.serviceStatuses = new Map();
    
    // Initialize service statuses
    const services = ['redis', 'clerk', 'database', 'webhook'];
    services.forEach(service => {
      this.serviceStatuses.set(service, {
        name: service,
        status: 'healthy',
        lastCheck: new Date(),
        responseTime: 0,
        errorRate: 0,
        consecutiveFailures: 0,
        circuitState: 'CLOSED'
      });
    });
  }
  
  public static getInstance(): GracefulDegradationService {
    if (!GracefulDegradationService.instance) {
      GracefulDegradationService.instance = new GracefulDegradationService();
    }
    return GracefulDegradationService.instance;
  }
  
  /**
   * Execute operation with graceful degradation
   */
  public async executeWithDegradation<T>(
    operation: () => Promise<T>,
    options: GracefulDegradationOptions & { fallbackStrategies?: FallbackStrategy<T>[] }
  ): Promise<T> {
    const startTime = performance.now();
    const operationKey = `${options.operationConfig.service}_${options.operationConfig.type}`;
    
    try {
      // Check circuit breaker status
      if (options.enableCircuitBreaker !== false) {
        const circuitState = await this.getCircuitBreakerState(options.operationConfig.service);
        if (circuitState === 'OPEN') {
          this.recordCircuitBreakerTrip(options.operationConfig.service);
          return await this.executeFallbackStrategies(options.fallbackStrategies || []) as T;
        }
      }
      
      // Execute with timeout
      const result = await this.executeWithTimeout(operation, options.operationConfig);
      
      // Record successful execution
      const duration = performance.now() - startTime;
      await this.recordSuccess(options.operationConfig.service, duration);
      
      // Cache result if enabled
      if (options.cacheResult && options.cacheTTL) {
        await this.cacheOperationResult(operationKey, result, options.cacheTTL);
      }
      
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      // Determine error type
      const isTimeout = error instanceof TimeoutError;
      const shouldFallback = isTimeout || this.shouldUseFallback(error);
      
      // Record failure
      await this.recordFailure(options.operationConfig.service, duration, error, isTimeout);
      
      // Try fallback strategies
      if (shouldFallback && options.fallbackStrategies) {
        try {
          const fallbackResult = await this.executeFallbackStrategies(options.fallbackStrategies);
          this.metrics.fallbacks.successful++;
          return fallbackResult;
        } catch (fallbackError) {
          this.metrics.fallbacks.failed++;
          // If all fallbacks fail, try cached result
          const cachedResult = await this.getCachedResult<T>(operationKey);
          if (cachedResult !== null) {
            return cachedResult;
          }
          throw fallbackError;
        }
      }
      
      // Retry logic for transient failures
      if (options.retryOnTimeout && isTimeout && (options.maxRetries || 1) > 0) {
        const retryOptions = { ...options, maxRetries: (options.maxRetries || 1) - 1 };
        return await this.executeWithDegradation(operation, retryOptions);
      }
      
      throw error;
    }
  }
  
  /**
   * Execute operation with timeout using Promise.race
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    operationConfig: OperationConfig
  ): Promise<T> {
    const timeoutMs = this.getOperationTimeout(operationConfig);
    const timeoutPromise = this.createTimeoutPromise(timeoutMs, operationConfig);
    
    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error) {
      // If it's our timeout error, record it
      if (error instanceof TimeoutError) {
        this.recordTimeout(operationConfig);
      }
      throw error;
    }
  }
  
  /**
   * Create a timeout promise that rejects after specified time
   */
  private createTimeoutPromise(timeoutMs: number, operationConfig: OperationConfig): Promise<never> {
    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TimeoutError(
          `Operation timed out after ${timeoutMs}ms`,
          operationConfig,
          timeoutMs
        ));
      }, timeoutMs);
      
      // Clean up timeout if the promise resolves/rejects elsewhere
      return () => clearTimeout(timeoutId);
    });
  }
  
  /**
   * Execute fallback strategies in priority order
   */
  private async executeFallbackStrategies<T>(
    strategies: FallbackStrategy<T>[]
  ): Promise<T> {
    if (strategies.length === 0) {
      throw new Error('No fallback strategies available');
    }
    
    // Sort by priority (lower number = higher priority)
    const sortedStrategies = [...strategies].sort((a, b) => a.priority - b.priority);
    
    this.metrics.fallbacks.total++;
    
    for (const strategy of sortedStrategies) {
      try {
        const result = await strategy.execute();
        return result;
      } catch (error) {
        console.warn(`Fallback strategy '${strategy.name}' failed:`, error);
        // Continue to next strategy
      }
    }
    
    throw new Error('All fallback strategies failed');
  }
  
  /**
   * Get circuit breaker state for a service
   */
  private async getCircuitBreakerState(serviceName: string): Promise<'CLOSED' | 'HALF_OPEN' | 'OPEN'> {
    try {
      const stateKey = `circuit_breaker:${serviceName}`;
      const state = await redis.get(stateKey);
      
      if (!state) return 'CLOSED';
      
      const circuitState = JSON.parse(state as string);
      const now = Date.now();
      
      // Check if circuit should transition from OPEN to HALF_OPEN
      if (circuitState.state === 'OPEN') {
        const timeSinceOpened = now - circuitState.openedAt;
        if (timeSinceOpened > this.timeoutConfig.circuitBreaker.recoveryTimeout) {
          await this.setCircuitBreakerState(serviceName, 'HALF_OPEN');
          return 'HALF_OPEN';
        }
      }
      
      return circuitState.state;
    } catch (error) {
      console.warn(`Failed to get circuit breaker state for ${serviceName}:`, error);
      return 'CLOSED'; // Fail safe
    }
  }
  
  /**
   * Set circuit breaker state for a service
   */
  private async setCircuitBreakerState(
    serviceName: string,
    state: 'CLOSED' | 'HALF_OPEN' | 'OPEN'
  ): Promise<void> {
    try {
      const stateKey = `circuit_breaker:${serviceName}`;
      const circuitState = {
        state,
        failures: state === 'CLOSED' ? 0 : undefined,
        openedAt: state === 'OPEN' ? Date.now() : undefined,
        lastFailure: Date.now()
      };
      
      await redis.setex(stateKey, 300, JSON.stringify(circuitState)); // 5 minute TTL
      
      // Update local service status
      const status = this.serviceStatuses.get(serviceName);
      if (status) {
        status.circuitState = state;
        status.lastCheck = new Date();
      }
      
    } catch (error) {
      console.error(`Failed to set circuit breaker state for ${serviceName}:`, error);
    }
  }
  
  /**
   * Record successful operation
   */
  private async recordSuccess(serviceName: string, duration: number): Promise<void> {
    const status = this.serviceStatuses.get(serviceName);
    if (status) {
      status.consecutiveFailures = 0;
      status.responseTime = duration;
      status.lastCheck = new Date();
      
      // Improve status if it was degraded
      if (status.status === 'degraded' && duration < this.timeoutConfig.performanceBudget.p95Threshold) {
        status.status = 'healthy';
      }
    }
    
    // If circuit was HALF_OPEN, close it on success
    const circuitState = await this.getCircuitBreakerState(serviceName);
    if (circuitState === 'HALF_OPEN') {
      await this.setCircuitBreakerState(serviceName, 'CLOSED');
      this.metrics.circuitBreaker.recovered++;
    }
  }
  
  /**
   * Record failed operation
   */
  private async recordFailure(
    serviceName: string,
    duration: number,
    error: unknown,
    isTimeout: boolean
  ): Promise<void> {
    const status = this.serviceStatuses.get(serviceName);
    if (status) {
      status.consecutiveFailures++;
      status.responseTime = duration;
      status.lastCheck = new Date();
      status.errorRate = Math.min(status.errorRate + 0.1, 1.0);
      
      // Update status based on consecutive failures
      if (status.consecutiveFailures >= 3) {
        status.status = 'unhealthy';
      } else if (status.consecutiveFailures >= 1 || isTimeout) {
        status.status = 'degraded';
      }
    }
    
    // Check if circuit breaker should trip
    if (status && status.consecutiveFailures >= this.timeoutConfig.circuitBreaker.failureThreshold) {
      await this.setCircuitBreakerState(serviceName, 'OPEN');
      this.metrics.circuitBreaker.tripped++;
      this.metrics.circuitBreaker.currentlyOpen.push(serviceName);
    }
  }
  
  /**
   * Record timeout occurrence
   */
  private recordTimeout(operationConfig: OperationConfig): void {
    this.metrics.timeouts.total++;
    this.metrics.timeouts.byService[operationConfig.service] = 
      (this.metrics.timeouts.byService[operationConfig.service] || 0) + 1;
    this.metrics.timeouts.byOperation[operationConfig.type] = 
      (this.metrics.timeouts.byOperation[operationConfig.type] || 0) + 1;
  }
  
  /**
   * Record circuit breaker trip
   */
  private recordCircuitBreakerTrip(serviceName: string): void {
    if (!this.metrics.circuitBreaker.currentlyOpen.includes(serviceName)) {
      this.metrics.circuitBreaker.currentlyOpen.push(serviceName);
    }
  }
  
  /**
   * Get operation timeout based on configuration
   */
  private getOperationTimeout(operationConfig: OperationConfig): number {
    const serviceTimeouts = this.timeoutConfig[operationConfig.service];
    if (typeof serviceTimeouts === 'object' && 'fast' in serviceTimeouts) {
      return serviceTimeouts[operationConfig.type];
    }
    return this.timeoutConfig.globalTimeout;
  }
  
  /**
   * Determine if we should use fallback for this error
   */
  private shouldUseFallback(error: unknown): boolean {
    // Always fallback for timeouts
    if (error instanceof TimeoutError) return true;
    
    // Fallback for network errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('timeout') ||
        message.includes('unavailable') ||
        message.includes('service') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')
      );
    }
    
    return false;
  }
  
  /**
   * Cache operation result
   */
  private async cacheOperationResult<T>(
    operationKey: string,
    result: T,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const cacheKey = `fallback_cache:${operationKey}`;
      await redis.setex(cacheKey, ttlSeconds, JSON.stringify(result));
    } catch (error) {
      console.warn('Failed to cache operation result:', error);
    }
  }
  
  /**
   * Get cached operation result
   */
  private async getCachedResult<T>(operationKey: string): Promise<T | null> {
    try {
      const cacheKey = `fallback_cache:${operationKey}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached as string) as T;
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to get cached result:', error);
      return null;
    }
  }
  
  /**
   * Get current metrics
   */
  public getMetrics(): DegradationMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get service statuses
   */
  public getServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatuses.values());
  }
  
  /**
   * Reset metrics (useful for testing)
   */
  public resetMetrics(): void {
    this.metrics = {
      timeouts: { total: 0, byService: {}, byOperation: {} },
      fallbacks: { total: 0, successful: 0, failed: 0 },
      performance: { p50: 0, p95: 0, p99: 0, errorRate: 0 },
      circuitBreaker: { tripped: 0, recovered: 0, currentlyOpen: [] }
    };
  }
  
  /**
   * Health check for the degradation service itself
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      servicesHealthy: number;
      servicesDegraded: number;
      servicesUnhealthy: number;
      circuitBreakersOpen: number;
      recentTimeouts: number;
      fallbackSuccessRate: number;
    };
  }> {
    const services = this.getServiceStatuses();
    const servicesHealthy = services.filter(s => s.status === 'healthy').length;
    const servicesDegraded = services.filter(s => s.status === 'degraded').length;
    const servicesUnhealthy = services.filter(s => s.status === 'unhealthy').length;
    const circuitBreakersOpen = this.metrics.circuitBreaker.currentlyOpen.length;
    
    const fallbackSuccessRate = this.metrics.fallbacks.total > 0 
      ? this.metrics.fallbacks.successful / this.metrics.fallbacks.total 
      : 1;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (servicesUnhealthy > 0 || circuitBreakersOpen > 1 || fallbackSuccessRate < 0.5) {
      status = 'unhealthy';
    } else if (servicesDegraded > 0 || circuitBreakersOpen > 0 || fallbackSuccessRate < 0.8) {
      status = 'degraded';
    }
    
    return {
      status,
      details: {
        servicesHealthy,
        servicesDegraded,
        servicesUnhealthy,
        circuitBreakersOpen,
        recentTimeouts: this.metrics.timeouts.total,
        fallbackSuccessRate
      }
    };
  }
}

/**
 * Custom timeout error class
 */
export class TimeoutError extends Error {
  public readonly operationConfig: OperationConfig;
  public readonly timeoutMs: number;
  public readonly timestamp: Date;
  
  constructor(message: string, operationConfig: OperationConfig, timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
    this.operationConfig = operationConfig;
    this.timeoutMs = timeoutMs;
    this.timestamp = new Date();
  }
}

/**
 * Singleton instance
 */
export const gracefulDegradation = GracefulDegradationService.getInstance();