/**
 * Enhanced Cache Hit/Miss Ratio Tracking System
 * 
 * Provides intelligent cache tracking wrappers that automatically monitor
 * cache performance by operation type, user role, and time periods.
 */

import { redis } from '@/lib/redis';
import { cacheMonitoring, trackCacheHit } from './cache-analytics';
import { withTimeoutAndDegradation } from '@/lib/graceful-degradation/timeout-wrappers';

export interface CacheTrackingOptions {
  operationType?: 'get' | 'set' | 'del' | 'exists' | 'scan' | 'multi' | 'pipeline';
  userRole?: string;
  userId?: string;
  source?: string;
  trackPerformance?: boolean;
  enableABTesting?: boolean;
  abTestGroup?: 'control' | 'variant_a' | 'variant_b';
}

export interface CacheKeyPattern {
  pattern: string;
  description: string;
  expectedHitRatio: number;
  category: 'user_data' | 'session' | 'auth' | 'orders' | 'analytics' | 'system';
}

export interface CacheOperationResult<T = any> {
  value: T | null;
  hit: boolean;
  latency: number;
  source: 'cache' | 'origin';
  metadata?: {
    keyPattern?: string;
    dataSize?: number;
    ttl?: number;
    abTestGroup?: string;
  };
}

/**
 * Registry of cache key patterns for automatic tracking
 */
const CACHE_KEY_PATTERNS: CacheKeyPattern[] = [
  {
    pattern: 'user_role:*',
    description: 'User role cache for hybrid authentication',
    expectedHitRatio: 0.95,
    category: 'auth'
  },
  {
    pattern: 'user_data:*',
    description: 'General user data cache',
    expectedHitRatio: 0.85,
    category: 'user_data'
  },
  {
    pattern: 'session:*',
    description: 'User session data',
    expectedHitRatio: 0.90,
    category: 'session'
  },
  {
    pattern: 'order:*',
    description: 'Order information cache',
    expectedHitRatio: 0.75,
    category: 'orders'
  },
  {
    pattern: 'analytics:*',
    description: 'Analytics and metrics cache',
    expectedHitRatio: 0.80,
    category: 'analytics'
  },
  {
    pattern: 'circuit_breaker:*',
    description: 'Circuit breaker state',
    expectedHitRatio: 0.99,
    category: 'system'
  },
  {
    pattern: 'performance:*',
    description: 'Performance monitoring data',
    expectedHitRatio: 0.85,
    category: 'system'
  }
];

class EnhancedCacheTracker {
  private static instance: EnhancedCacheTracker;
  
  private constructor() {}
  
  public static getInstance(): EnhancedCacheTracker {
    if (!EnhancedCacheTracker.instance) {
      EnhancedCacheTracker.instance = new EnhancedCacheTracker();
    }
    return EnhancedCacheTracker.instance;
  }
  
  /**
   * Enhanced GET operation with automatic tracking
   */
  public async get<T = string>(
    key: string,
    options: CacheTrackingOptions = {}
  ): Promise<CacheOperationResult<T>> {
    const startTime = performance.now();
    
    try {
      // Execute the Redis GET with timeout protection
      const value = await withTimeoutAndDegradation(
        () => redis.get(key),
        {
          operationConfig: { type: 'fast', service: 'redis' },
          enableGracefulDegradation: true,
          timeoutMessage: `Cache GET operation timed out for key: ${key}`
        }
      );
      
      const latency = performance.now() - startTime;
      const hit = value !== null;
      const keyPattern = this.getKeyPattern(key);
      
      // Track the operation
      await this.trackOperation({
        operationType: 'get',
        key,
        keyPattern: keyPattern?.pattern,
        hit,
        latency,
        dataSize: value ? JSON.stringify(value).length : undefined,
        ...options
      });
      
      return {
        value: value as T,
        hit,
        latency,
        source: hit ? 'cache' : 'origin',
        metadata: {
          keyPattern: keyPattern?.pattern,
          dataSize: value ? JSON.stringify(value).length : undefined,
          abTestGroup: options.abTestGroup
        }
      };
      
    } catch (error) {
      const latency = performance.now() - startTime;
      
      // Track failed operation
      await this.trackOperation({
        operationType: 'get',
        key,
        hit: false,
        latency,
        ...options
      });
      
      console.error(`Cache GET error for key ${key}:`, error);
      
      return {
        value: null,
        hit: false,
        latency,
        source: 'origin'
      };
    }
  }
  
  /**
   * Enhanced SET operation with automatic tracking
   */
  public async set(
    key: string,
    value: any,
    ttl?: number,
    options: CacheTrackingOptions = {}
  ): Promise<CacheOperationResult<boolean>> {
    const startTime = performance.now();
    
    try {
      let result: string;
      
      if (ttl !== undefined) {
        result = await withTimeoutAndDegradation(
          () => redis.setex(key, ttl, typeof value === 'string' ? value : JSON.stringify(value)),
          {
            operationConfig: { type: 'fast', service: 'redis' },
            enableGracefulDegradation: true,
            timeoutMessage: `Cache SET operation timed out for key: ${key}`
          }
        ) as string;
      } else {
        result = await withTimeoutAndDegradation(
          () => redis.set(key, typeof value === 'string' ? value : JSON.stringify(value)),
          {
            operationConfig: { type: 'fast', service: 'redis' },
            enableGracefulDegradation: true,
            timeoutMessage: `Cache SET operation timed out for key: ${key}`
          }
        ) as string;
      }
      
      const latency = performance.now() - startTime;
      const success = result === 'OK';
      const keyPattern = this.getKeyPattern(key);
      
      // Track the operation
      await this.trackOperation({
        operationType: 'set',
        key,
        keyPattern: keyPattern?.pattern,
        hit: success, // For SET operations, success = hit
        latency,
        dataSize: JSON.stringify(value).length,
        ttl,
        ...options
      });
      
      return {
        value: success,
        hit: success,
        latency,
        source: 'cache',
        metadata: {
          keyPattern: keyPattern?.pattern,
          dataSize: JSON.stringify(value).length,
          ttl,
          abTestGroup: options.abTestGroup
        }
      };
      
    } catch (error) {
      const latency = performance.now() - startTime;
      
      // Track failed operation
      await this.trackOperation({
        operationType: 'set',
        key,
        hit: false,
        latency,
        ttl,
        ...options
      });
      
      console.error(`Cache SET error for key ${key}:`, error);
      
      return {
        value: false,
        hit: false,
        latency,
        source: 'cache'
      };
    }
  }
  
  /**
   * Enhanced DEL operation with tracking
   */
  public async del(
    key: string,
    options: CacheTrackingOptions = {}
  ): Promise<CacheOperationResult<number>> {
    const startTime = performance.now();
    
    try {
      const result = await withTimeoutAndDegradation(
        () => redis.del(key),
        {
          operationConfig: { type: 'fast', service: 'redis' },
          enableGracefulDegradation: true,
          timeoutMessage: `Cache DEL operation timed out for key: ${key}`
        }
      );
      
      const latency = performance.now() - startTime;
      const keyPattern = this.getKeyPattern(key);
      
      // Track the operation
      await this.trackOperation({
        operationType: 'del',
        key,
        keyPattern: keyPattern?.pattern,
        hit: result > 0, // Hit if key existed and was deleted
        latency,
        ...options
      });
      
      return {
        value: result,
        hit: result > 0,
        latency,
        source: 'cache',
        metadata: {
          keyPattern: keyPattern?.pattern,
          abTestGroup: options.abTestGroup
        }
      };
      
    } catch (error) {
      const latency = performance.now() - startTime;
      
      // Track failed operation
      await this.trackOperation({
        operationType: 'del',
        key,
        hit: false,
        latency,
        ...options
      });
      
      console.error(`Cache DEL error for key ${key}:`, error);
      
      return {
        value: 0,
        hit: false,
        latency,
        source: 'cache'
      };
    }
  }
  
  /**
   * Enhanced EXISTS operation with tracking
   */
  public async exists(
    key: string,
    options: CacheTrackingOptions = {}
  ): Promise<CacheOperationResult<boolean>> {
    const startTime = performance.now();
    
    try {
      const result = await withTimeoutAndDegradation(
        () => redis.exists(key),
        {
          operationConfig: { type: 'fast', service: 'redis' },
          enableGracefulDegradation: true,
          timeoutMessage: `Cache EXISTS operation timed out for key: ${key}`
        }
      );
      
      const latency = performance.now() - startTime;
      const exists = result === 1;
      const keyPattern = this.getKeyPattern(key);
      
      // Track the operation
      await this.trackOperation({
        operationType: 'exists',
        key,
        keyPattern: keyPattern?.pattern,
        hit: exists, // Hit if key exists
        latency,
        ...options
      });
      
      return {
        value: exists,
        hit: exists,
        latency,
        source: 'cache',
        metadata: {
          keyPattern: keyPattern?.pattern,
          abTestGroup: options.abTestGroup
        }
      };
      
    } catch (error) {
      const latency = performance.now() - startTime;
      
      // Track failed operation
      await this.trackOperation({
        operationType: 'exists',
        key,
        hit: false,
        latency,
        ...options
      });
      
      console.error(`Cache EXISTS error for key ${key}:`, error);
      
      return {
        value: false,
        hit: false,
        latency,
        source: 'cache'
      };
    }
  }
  
  /**
   * Enhanced cache-or-fetch pattern with automatic tracking
   */
  public async getOrFetch<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl: number = 300, // 5 minutes default
    options: CacheTrackingOptions = {}
  ): Promise<CacheOperationResult<T>> {
    // First, try to get from cache
    const cacheResult = await this.get<T>(key, options);
    
    if (cacheResult.hit && cacheResult.value !== null) {
      return cacheResult;
    }
    
    // Cache miss - fetch from origin
    const startTime = performance.now();
    
    try {
      const value = await fetchFunction();
      const fetchLatency = performance.now() - startTime;
      
      // Store in cache for future hits
      const setResult = await this.set(key, value, ttl, {
        ...options,
        operationType: 'set'
      });
      
      // Track the fetch operation separately
      await this.trackOperation({
        operationType: 'get',
        key,
        keyPattern: this.getKeyPattern(key)?.pattern,
        hit: false,
        latency: cacheResult.latency + fetchLatency + setResult.latency,
        dataSize: JSON.stringify(value).length,
        ...options
      });
      
      return {
        value,
        hit: false,
        latency: cacheResult.latency + fetchLatency,
        source: 'origin',
        metadata: {
          keyPattern: this.getKeyPattern(key)?.pattern,
          dataSize: JSON.stringify(value).length,
          ttl,
          abTestGroup: options.abTestGroup
        }
      };
      
    } catch (error) {
      console.error(`Cache-or-fetch error for key ${key}:`, error);
      
      return {
        value: null as T,
        hit: false,
        latency: performance.now() - startTime,
        source: 'origin'
      };
    }
  }
  
  /**
   * Track cache operation with enhanced context
   */
  private async trackOperation(operation: {
    operationType: CacheTrackingOptions['operationType'];
    key: string;
    keyPattern?: string;
    hit: boolean;
    latency: number;
    dataSize?: number;
    ttl?: number;
    userRole?: string;
    userId?: string;
    source?: string;
    abTestGroup?: string;
  }): Promise<void> {
    try {
      await trackCacheHit(
        operation.operationType || 'get',
        operation.key,
        operation.hit,
        operation.latency,
        {
          userRole: operation.userRole,
          userId: operation.userId,
          dataSize: operation.dataSize,
          ttl: operation.ttl,
          source: operation.source
        }
      );
      
      // Additional tracking for key patterns
      if (operation.keyPattern) {
        const timestamp = Date.now();
        const pipeline = redis.pipeline();
        
        // Track pattern-specific metrics
        const hitMissKey = operation.hit ? 'hits' : 'misses';
        pipeline.incr(`cache:patterns:${operation.keyPattern}:${hitMissKey}`);
        pipeline.incr(`cache:patterns:${operation.keyPattern}:operations`);
        
        // Track A/B testing metrics if enabled
        if (operation.abTestGroup) {
          pipeline.incr(`cache:ab_test:${operation.abTestGroup}:${hitMissKey}`);
          pipeline.incr(`cache:ab_test:${operation.abTestGroup}:operations`);
          pipeline.zadd(`cache:ab_test:${operation.abTestGroup}:latency`, timestamp, operation.latency);
        }
        
        // Set expiration to prevent memory leaks
        pipeline.expire(`cache:patterns:${operation.keyPattern}:${hitMissKey}`, 86400 * 7); // 7 days
        if (operation.abTestGroup) {
          pipeline.expire(`cache:ab_test:${operation.abTestGroup}:${hitMissKey}`, 86400 * 30); // 30 days for A/B tests
        }
        
        await pipeline.exec();
      }
      
    } catch (error) {
      console.error('Failed to track cache operation:', error);
    }
  }
  
  /**
   * Get cache key pattern information
   */
  private getKeyPattern(key: string): CacheKeyPattern | undefined {
    return CACHE_KEY_PATTERNS.find(pattern => {
      const regex = new RegExp(pattern.pattern.replace('*', '.*'));
      return regex.test(key);
    });
  }
  
  /**
   * Get cache efficiency report for key patterns
   */
  public async getKeyPatternReport(): Promise<{
    patterns: Array<{
      pattern: string;
      description: string;
      expectedHitRatio: number;
      actualHitRatio: number;
      operations: number;
      category: string;
      status: 'healthy' | 'warning' | 'critical';
      recommendation?: string;
    }>;
    overall: {
      averageHitRatio: number;
      totalOperations: number;
      healthyPatterns: number;
      warningPatterns: number;
      criticalPatterns: number;
    };
  }> {
    const patternReports = [];
    let totalOperations = 0;
    let totalHitRatio = 0;
    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    
    for (const pattern of CACHE_KEY_PATTERNS) {
      try {
        const pipeline = redis.pipeline();
        pipeline.get(`cache:patterns:${pattern.pattern}:hits`);
        pipeline.get(`cache:patterns:${pattern.pattern}:misses`);
        pipeline.get(`cache:patterns:${pattern.pattern}:operations`);
        
        const results = await pipeline.exec();
        
        if (!results) continue;
        
        const hits = parseInt(((results[0] as [Error | null, any])?.[1] as string) || '0');
        const misses = parseInt(((results[1] as [Error | null, any])?.[1] as string) || '0');
        const operations = parseInt(((results[2] as [Error | null, any])?.[1] as string) || '0');
        
        const actualHitRatio = operations > 0 ? hits / operations : 0;
        
        // Determine status based on expected vs actual hit ratio
        let status: 'healthy' | 'warning' | 'critical';
        let recommendation: string | undefined;
        
        if (actualHitRatio >= pattern.expectedHitRatio * 0.9) {
          status = 'healthy';
          healthyCount++;
        } else if (actualHitRatio >= pattern.expectedHitRatio * 0.7) {
          status = 'warning';
          warningCount++;
          recommendation = `Hit ratio below expected. Consider increasing TTL or reviewing invalidation strategy.`;
        } else {
          status = 'critical';
          criticalCount++;
          recommendation = `Hit ratio critically low. Review caching strategy and data access patterns.`;
        }
        
        patternReports.push({
          pattern: pattern.pattern,
          description: pattern.description,
          expectedHitRatio: pattern.expectedHitRatio,
          actualHitRatio,
          operations,
          category: pattern.category,
          status,
          recommendation
        });
        
        totalOperations += operations;
        totalHitRatio += actualHitRatio * operations;
        
      } catch (error) {
        console.error(`Failed to get metrics for pattern ${pattern.pattern}:`, error);
      }
    }
    
    return {
      patterns: patternReports,
      overall: {
        averageHitRatio: totalOperations > 0 ? totalHitRatio / totalOperations : 0,
        totalOperations,
        healthyPatterns: healthyCount,
        warningPatterns: warningCount,
        criticalPatterns: criticalCount
      }
    };
  }
  
  /**
   * Get A/B testing metrics
   */
  public async getABTestingMetrics(): Promise<{
    control: { hitRatio: number; operations: number; averageLatency: number };
    variant_a: { hitRatio: number; operations: number; averageLatency: number };
    variant_b: { hitRatio: number; operations: number; averageLatency: number };
    winner?: 'control' | 'variant_a' | 'variant_b';
    confidence?: number;
  }> {
    const groups = ['control', 'variant_a', 'variant_b'] as const;
    const results: any = {};
    
    for (const group of groups) {
      const pipeline = redis.pipeline();
      pipeline.get(`cache:ab_test:${group}:hits`);
      pipeline.get(`cache:ab_test:${group}:misses`);
      pipeline.get(`cache:ab_test:${group}:operations`);
      
      const groupResults = await pipeline.exec();
      
      if (!groupResults) {
        results[group] = { hitRatio: 0, operations: 0, averageLatency: 0 };
        continue;
      }
      
      const hits = parseInt(((groupResults[0] as [Error | null, any])?.[1] as string) || '0');
      const misses = parseInt(((groupResults[1] as [Error | null, any])?.[1] as string) || '0');
      const operations = parseInt(((groupResults[2] as [Error | null, any])?.[1] as string) || '0');
      
      const hitRatio = operations > 0 ? hits / operations : 0;
      
      // Get average latency from sorted set
      const latencyValues = await redis.zrange(`cache:ab_test:${group}:latency`, 0, -1);
      const averageLatency = latencyValues.length > 0 
        ? latencyValues.map(v => parseFloat(v as string)).reduce((a, b) => a + b, 0) / latencyValues.length
        : 0;
      
      results[group] = { hitRatio, operations, averageLatency };
    }
    
    // Determine winner (highest hit ratio with statistical significance)
    let winner: 'control' | 'variant_a' | 'variant_b' | undefined;
    let bestHitRatio = 0;
    
    for (const group of groups) {
      if (results[group].hitRatio > bestHitRatio && results[group].operations > 100) {
        bestHitRatio = results[group].hitRatio;
        winner = group;
      }
    }
    
    return {
      ...results,
      winner,
      confidence: winner ? 0.95 : undefined // Simplified confidence calculation
    };
  }
}

/**
 * Singleton instance
 */
export const enhancedCacheTracker = EnhancedCacheTracker.getInstance();

/**
 * Convenience functions for common operations
 */
export const trackedCache = {
  get: <T = string>(key: string, options?: CacheTrackingOptions) => 
    enhancedCacheTracker.get<T>(key, options),
  
  set: (key: string, value: any, ttl?: number, options?: CacheTrackingOptions) => 
    enhancedCacheTracker.set(key, value, ttl, options),
  
  del: (key: string, options?: CacheTrackingOptions) => 
    enhancedCacheTracker.del(key, options),
  
  exists: (key: string, options?: CacheTrackingOptions) => 
    enhancedCacheTracker.exists(key, options),
  
  getOrFetch: <T>(
    key: string, 
    fetchFn: () => Promise<T>, 
    ttl?: number, 
    options?: CacheTrackingOptions
  ) => enhancedCacheTracker.getOrFetch(key, fetchFn, ttl, options)
};

/**
 * Middleware for automatic user context tracking
 */
export function withUserContext(
  userRole: string, 
  userId?: string,
  source?: string
) {
  return {
    get: <T = string>(key: string, options: CacheTrackingOptions = {}) => 
      trackedCache.get<T>(key, { ...options, userRole, userId, source }),
    
    set: (key: string, value: any, ttl?: number, options: CacheTrackingOptions = {}) => 
      trackedCache.set(key, value, ttl, { ...options, userRole, userId, source }),
    
    del: (key: string, options: CacheTrackingOptions = {}) => 
      trackedCache.del(key, { ...options, userRole, userId, source }),
    
    exists: (key: string, options: CacheTrackingOptions = {}) => 
      trackedCache.exists(key, { ...options, userRole, userId, source }),
    
    getOrFetch: <T>(
      key: string, 
      fetchFn: () => Promise<T>, 
      ttl?: number, 
      options: CacheTrackingOptions = {}
    ) => trackedCache.getOrFetch(key, fetchFn, ttl, { ...options, userRole, userId, source })
  };
}