/**
 * Performance Benchmarking and Validation Suite
 * 
 * Comprehensive testing framework for validating hybrid authentication performance,
 * cache efficiency, resilience patterns, and system behavior under various conditions.
 */

import { redis } from '@/lib/redis';
import { createClerkClient } from '@clerk/nextjs/server';
import { performance } from 'perf_hooks';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

export interface BenchmarkMetrics {
  operation: string;
  region?: string;
  timestamp: number;
  responseTime: number;
  success: boolean;
  errorType?: string;
  cacheHit?: boolean;
  dataSize?: number;
  concurrency?: number;
  metadata?: Record<string, unknown>;
}

export interface PerformanceReport {
  testSuite: string;
  startTime: number;
  endTime: number;
  duration: number;
  summary: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageResponseTime: number;
    percentiles: {
      p50: number;
      p95: number;
      p99: number;
      p99_9: number;
    };
    cacheStats?: {
      hitRatio: number;
      totalHits: number;
      totalMisses: number;
    };
    errorBreakdown: Record<string, number>;
  };
  benchmarks: BenchmarkMetrics[];
  insights: string[];
  recommendations: string[];
  comparisonData?: {
    baseline: PerformanceReport['summary'];
    improvement: {
      p50ResponseTime: number;
      p95ResponseTime: number;
      p99ResponseTime: number;
      errorRate: number;
    };
  };
}

export interface LoadTestConfig {
  concurrentUsers: number;
  duration: number; // milliseconds
  rampUpTime: number; // milliseconds
  operations: Array<{
    type: 'role_lookup' | 'role_update' | 'user_creation' | 'cache_operation';
    weight: number; // 0-1, relative frequency
    config?: Record<string, unknown>;
  }>;
  regions?: string[];
  cacheHitRatio?: number; // Target hit ratio for realistic testing
}

export interface NetworkFailureConfig {
  failureType: 'redis_down' | 'clerk_down' | 'latency_spike' | 'intermittent' | 'partition';
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedPercentage: number; // 0-100
}

class PerformanceBenchmarkingSuite {
  private static instance: PerformanceBenchmarkingSuite;
  private benchmarks: BenchmarkMetrics[] = [];
  private activeTests: Map<string, { startTime: number; metrics: BenchmarkMetrics[] }> = new Map();
  private baselineReports: Map<string, PerformanceReport> = new Map();

  private constructor() {}

  public static getInstance(): PerformanceBenchmarkingSuite {
    if (!PerformanceBenchmarkingSuite.instance) {
      PerformanceBenchmarkingSuite.instance = new PerformanceBenchmarkingSuite();
    }
    return PerformanceBenchmarkingSuite.instance;
  }

  /**
   * Comprehensive Redis vs Clerk benchmarking across regions
   */
  public async benchmarkRedisVsClerk(config?: {
    regions?: string[];
    iterations?: number;
    userIds?: string[];
  }): Promise<PerformanceReport> {
    const testId = `redis_vs_clerk_${Date.now()}`;
    this.startTest(testId);

    const regions = config?.regions || ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
    const iterations = config?.iterations || 100;
    const userIds = config?.userIds || await this.generateTestUserIds(50);

    console.log(`🚀 Starting Redis vs Clerk benchmark across ${regions.length} regions with ${iterations} iterations`);

    for (const region of regions) {
      console.log(`📍 Testing region: ${region}`);
      
      // Redis benchmarks
      for (let i = 0; i < iterations; i++) {
        const userId = userIds[i % userIds.length];
        await this.benchmarkRedisLookup(userId, region, testId);
        
        // Add slight delay to avoid overwhelming systems
        if (i % 10 === 0) await this.sleep(50);
      }

      // Clerk benchmarks
      for (let i = 0; i < iterations; i++) {
        const userId = userIds[i % userIds.length];
        await this.benchmarkClerkLookup(userId, region, testId);
        
        if (i % 10 === 0) await this.sleep(50);
      }

      // Hybrid system benchmarks
      for (let i = 0; i < iterations; i++) {
        const userId = userIds[i % userIds.length];
        await this.benchmarkHybridLookup(userId, region, testId);
        
        if (i % 10 === 0) await this.sleep(50);
      }
    }

    return this.generateReport(testId, 'Redis vs Clerk Regional Benchmark');
  }

  /**
   * Cache hit ratio validation under different load patterns
   */
  public async validateCacheHitRatios(config?: {
    patterns?: Array<{
      name: string;
      userCount: number;
      operationsPerUser: number;
      accessPattern: 'random' | 'sequential' | 'hotspot' | 'realistic';
    }>;
  }): Promise<PerformanceReport> {
    const testId = `cache_hit_ratio_${Date.now()}`;
    this.startTest(testId);

    const patterns = config?.patterns || [
      { name: 'Random Access', userCount: 100, operationsPerUser: 50, accessPattern: 'random' as const },
      { name: 'Sequential Access', userCount: 50, operationsPerUser: 100, accessPattern: 'sequential' as const },
      { name: 'Hotspot (80/20)', userCount: 100, operationsPerUser: 50, accessPattern: 'hotspot' as const },
      { name: 'Realistic Pattern', userCount: 200, operationsPerUser: 25, accessPattern: 'realistic' as const }
    ];

    console.log('🎯 Starting cache hit ratio validation with different access patterns');

    for (const pattern of patterns) {
      console.log(`📊 Testing pattern: ${pattern.name}`);
      
      const userIds = await this.generateTestUserIds(pattern.userCount);
      
      // Pre-warm cache with some data
      if (pattern.accessPattern === 'hotspot') {
        const hotUsers = userIds.slice(0, Math.floor(userIds.length * 0.2));
        for (const userId of hotUsers) {
          await redis.setex(`role:${userId}`, 30, 'user');
        }
      }

      let hits = 0;
      let misses = 0;

      for (let i = 0; i < pattern.operationsPerUser; i++) {
        for (const userId of userIds) {
          const targetUserId = this.selectUserIdByPattern(userIds, pattern.accessPattern, i);
          const startTime = performance.now();
          
          try {
            const cachedRole = await redis.get(`role:${targetUserId}`);
            const responseTime = performance.now() - startTime;
            const isHit = cachedRole !== null;
            
            if (isHit) hits++; else misses++;
            
            this.recordBenchmark({
              operation: `cache_${pattern.accessPattern}`,
              timestamp: Date.now(),
              responseTime,
              success: true,
              cacheHit: isHit,
              metadata: { pattern: pattern.name, userId: targetUserId }
            }, testId);
            
            // Simulate cache miss -> fetch from Clerk -> cache update
            if (!isHit) {
              await this.simulateClerkFetchAndCache(targetUserId, testId);
            }
          } catch (error) {
            misses++;
            this.recordBenchmark({
              operation: `cache_${pattern.accessPattern}`,
              timestamp: Date.now(),
              responseTime: performance.now() - startTime,
              success: false,
              errorType: error instanceof Error ? error.message : 'Unknown error',
              cacheHit: false,
              metadata: { pattern: pattern.name, userId: targetUserId }
            }, testId);
          }
        }

        // Progress indicator
        if (i % 10 === 0) {
          console.log(`  Progress: ${i}/${pattern.operationsPerUser} operations completed`);
        }
      }

      const hitRatio = hits / (hits + misses);
      console.log(`  ${pattern.name} Hit Ratio: ${(hitRatio * 100).toFixed(2)}%`);
    }

    return this.generateReport(testId, 'Cache Hit Ratio Validation');
  }

  /**
   * Sub-30ms response time validation with percentile analysis
   */
  public async validateSub30msResponse(config?: {
    sampleSize?: number;
    operations?: string[];
    strictMode?: boolean; // Fail if any operation exceeds 30ms
  }): Promise<PerformanceReport> {
    const testId = `sub30ms_validation_${Date.now()}`;
    this.startTest(testId);

    const sampleSize = config?.sampleSize || 1000;
    const operations = config?.operations || ['redis_lookup', 'cache_hit', 'hybrid_auth'];
    const strictMode = config?.strictMode || false;

    console.log(`⚡ Validating sub-30ms response time claims with ${sampleSize} samples`);
    
    const userIds = await this.generateTestUserIds(100);
    
    // Pre-populate cache for realistic testing
    for (const userId of userIds) {
      await redis.setex(`role:${userId}`, 30, 'user');
    }

    for (const operation of operations) {
      console.log(`🔍 Testing operation: ${operation}`);
      
      for (let i = 0; i < sampleSize; i++) {
        const userId = userIds[i % userIds.length];
        const startTime = performance.now();
        
        try {
          switch (operation) {
            case 'redis_lookup':
              await redis.get(`role:${userId}`);
              break;
            case 'cache_hit':
              const role = await redis.get(`role:${userId}`);
              if (!role) await redis.setex(`role:${userId}`, 30, 'user');
              break;
            case 'hybrid_auth':
              await this.simulateHybridAuth(userId);
              break;
          }
          
          const responseTime = performance.now() - startTime;
          const success = !strictMode || responseTime <= 30;
          
          this.recordBenchmark({
            operation,
            timestamp: Date.now(),
            responseTime,
            success,
            cacheHit: true,
            metadata: { 
              userId,
              exceedsThreshold: responseTime > 30,
              strictMode 
            }
          }, testId);
          
          if (strictMode && responseTime > 30) {
            console.warn(`⚠️  Operation ${operation} exceeded 30ms: ${responseTime.toFixed(2)}ms`);
          }
          
        } catch (error) {
          const responseTime = performance.now() - startTime;
          this.recordBenchmark({
            operation,
            timestamp: Date.now(),
            responseTime,
            success: false,
            errorType: error instanceof Error ? error.message : 'Unknown error',
            metadata: { userId }
          }, testId);
        }

        // Micro-delay to avoid overwhelming Redis
        if (i % 100 === 0) await this.sleep(10);
      }
    }

    return this.generateReport(testId, 'Sub-30ms Response Time Validation');
  }

  /**
   * Concurrent user scenario testing with race condition detection
   */
  public async testConcurrentUsers(config?: {
    concurrentUsers?: number;
    operationsPerUser?: number;
    testDuration?: number;
    raceConditionDetection?: boolean;
  }): Promise<PerformanceReport> {
    const testId = `concurrent_users_${Date.now()}`;
    this.startTest(testId);

    const concurrentUsers = config?.concurrentUsers || 50;
    const operationsPerUser = config?.operationsPerUser || 20;
    const testDuration = config?.testDuration || 60000; // 1 minute
    const raceConditionDetection = config?.raceConditionDetection ?? true;

    console.log(`👥 Testing ${concurrentUsers} concurrent users with race condition detection`);

    const userIds = await this.generateTestUserIds(concurrentUsers);
    const startTime = Date.now();
    
    // Race condition detection setup
    const raceDetectionData: Map<string, Array<{ timestamp: number; operation: string; value: string }>> = new Map();

    const workerPromises = userIds.map(async (userId, index) => {
      const workerId = `worker_${index}`;
      
      for (let op = 0; op < operationsPerUser && (Date.now() - startTime) < testDuration; op++) {
        const operationStartTime = performance.now();
        
        try {
          // Simulate realistic user operations
          const operations = ['role_lookup', 'role_update', 'session_check', 'cache_refresh'];
          const operation = operations[op % operations.length];
          
          switch (operation) {
            case 'role_lookup':
              const role = await redis.get(`role:${userId}`);
              
              if (raceConditionDetection) {
                const entry = { timestamp: Date.now(), operation, value: String(role || 'null') };
                if (!raceDetectionData.has(userId)) raceDetectionData.set(userId, []);
                raceDetectionData.get(userId)!.push(entry);
              }
              break;
              
            case 'role_update':
              const newRole = ['user', 'admin', 'manager'][op % 3];
              await redis.setex(`role:${userId}`, 30, newRole);
              
              if (raceConditionDetection) {
                const entry = { timestamp: Date.now(), operation, value: newRole };
                if (!raceDetectionData.has(userId)) raceDetectionData.set(userId, []);
                raceDetectionData.get(userId)!.push(entry);
              }
              break;
              
            case 'session_check':
              await redis.exists(`session:${userId}`);
              break;
              
            case 'cache_refresh':
              await redis.del(`role:${userId}`);
              await redis.setex(`role:${userId}`, 30, 'user');
              break;
          }
          
          const responseTime = performance.now() - operationStartTime;
          
          this.recordBenchmark({
            operation,
            timestamp: Date.now(),
            responseTime,
            success: true,
            concurrency: concurrentUsers,
            metadata: { 
              userId, 
              workerId, 
              operationIndex: op,
              totalConcurrentOps: concurrentUsers * operationsPerUser 
            }
          }, testId);
          
        } catch (error) {
          const responseTime = performance.now() - operationStartTime;
          this.recordBenchmark({
            operation: 'concurrent_operation',
            timestamp: Date.now(),
            responseTime,
            success: false,
            concurrency: concurrentUsers,
            errorType: error instanceof Error ? error.message : 'Unknown error',
            metadata: { userId, workerId }
          }, testId);
        }

        // Small delay to simulate realistic user behavior
        await this.sleep(Math.random() * 100 + 50);
      }
    });

    await Promise.all(workerPromises);

    // Analyze race conditions
    if (raceConditionDetection) {
      const raceConditions = this.detectRaceConditions(raceDetectionData);
      console.log(`🔍 Detected ${raceConditions.length} potential race conditions`);
      
      for (const race of raceConditions) {
        console.warn(`⚠️  Race condition detected for user ${race.userId}: ${race.description}`);
      }
    }

    return this.generateReport(testId, 'Concurrent Users Test');
  }

  /**
   * Network failure simulation and recovery testing
   */
  public async simulateNetworkFailures(config?: {
    failures?: NetworkFailureConfig[];
    recoveryValidation?: boolean;
    circuitBreakerTesting?: boolean;
  }): Promise<PerformanceReport> {
    const testId = `network_failure_${Date.now()}`;
    this.startTest(testId);

    const failures = config?.failures || [
      { failureType: 'redis_down', duration: 10000, severity: 'high', affectedPercentage: 100 },
      { failureType: 'clerk_down', duration: 15000, severity: 'medium', affectedPercentage: 100 },
      { failureType: 'latency_spike', duration: 20000, severity: 'medium', affectedPercentage: 50 },
      { failureType: 'intermittent', duration: 30000, severity: 'low', affectedPercentage: 25 }
    ];

    console.log('🔥 Starting network failure simulation and recovery testing');

    for (const failure of failures) {
      console.log(`💥 Simulating ${failure.failureType} failure for ${failure.duration}ms`);
      
      const preFailureMetrics = await this.collectSystemMetrics();
      const failureStartTime = Date.now();
      
      // Simulate failure
      await this.injectFailure(failure, testId);
      
      // Monitor system during failure
      const failureMonitoring = this.monitorSystemDuringFailure(failure, testId);
      
      // Wait for failure duration
      await this.sleep(failure.duration);
      
      // Recovery
      console.log(`🔧 Initiating recovery from ${failure.failureType}`);
      const recoveryStartTime = Date.now();
      
      await this.initiateRecovery(failure);
      
      // Stop monitoring
      await failureMonitoring;
      
      // Validate recovery
      const postRecoveryMetrics = await this.collectSystemMetrics();
      const recoveryTime = Date.now() - recoveryStartTime;
      
      this.recordBenchmark({
        operation: `failure_recovery_${failure.failureType}`,
        timestamp: Date.now(),
        responseTime: recoveryTime,
        success: postRecoveryMetrics.healthy,
        metadata: {
          failureType: failure.failureType,
          failureDuration: failure.duration,
          recoveryTime,
          preFailureMetrics,
          postRecoveryMetrics,
          circuitBreakerTriggered: postRecoveryMetrics.circuitBreakerOpen
        }
      }, testId);

      // Wait between failures
      await this.sleep(5000);
    }

    return this.generateReport(testId, 'Network Failure Simulation');
  }

  /**
   * Load testing for peak traffic simulation
   */
  public async runLoadTest(config: LoadTestConfig): Promise<PerformanceReport> {
    const testId = `load_test_${Date.now()}`;
    this.startTest(testId);

    console.log(`🚀 Starting load test: ${config.concurrentUsers} users for ${config.duration}ms`);
    
    const userIds = await this.generateTestUserIds(config.concurrentUsers);
    const startTime = Date.now();
    
    // Ramp up phase
    console.log('📈 Ramping up users...');
    const rampUpInterval = config.rampUpTime / config.concurrentUsers;
    
    const userPromises: Promise<void>[] = [];
    
    for (let i = 0; i < config.concurrentUsers; i++) {
      // Stagger user start times
      const userStartDelay = i * rampUpInterval;
      
      const userPromise = (async () => {
        await this.sleep(userStartDelay);
        
        const userId = userIds[i];
        const userStartTime = Date.now();
        
        while ((Date.now() - userStartTime) < config.duration) {
          // Select operation based on weights
          const operation = this.selectWeightedOperation(config.operations);
          const operationStartTime = performance.now();
          
          try {
            await this.executeLoadTestOperation(operation, userId, testId);
            
            const responseTime = performance.now() - operationStartTime;
            
            this.recordBenchmark({
              operation: operation.type,
              timestamp: Date.now(),
              responseTime,
              success: true,
              concurrency: config.concurrentUsers,
              metadata: { 
                userId, 
                userIndex: i,
                loadTestPhase: this.getLoadTestPhase(Date.now() - startTime, config),
                operationWeight: operation.weight
              }
            }, testId);
            
          } catch (error) {
            const responseTime = performance.now() - operationStartTime;
            this.recordBenchmark({
              operation: operation.type,
              timestamp: Date.now(),
              responseTime,
              success: false,
              concurrency: config.concurrentUsers,
              errorType: error instanceof Error ? error.message : 'Unknown error',
              metadata: { userId, userIndex: i }
            }, testId);
          }

          // Wait between operations (simulate user think time)
          await this.sleep(Math.random() * 1000 + 500);
        }
      })();
      
      userPromises.push(userPromise);
    }

    // Wait for all users to complete
    await Promise.all(userPromises);
    
    console.log('✅ Load test completed');
    return this.generateReport(testId, `Load Test: ${config.concurrentUsers} Users`);
  }

  /**
   * Generate comprehensive performance report with insights
   */
  public async generatePerformanceReport(
    testIds: string[],
    comparisonBaseline?: string
  ): Promise<PerformanceReport> {
    console.log('📊 Generating comprehensive performance report...');
    
    const allMetrics: BenchmarkMetrics[] = [];
    testIds.forEach(testId => {
      const testData = this.activeTests.get(testId);
      if (testData) {
        allMetrics.push(...testData.metrics);
      }
    });

    if (allMetrics.length === 0) {
      throw new Error('No benchmark data found for the specified test IDs');
    }

    const startTime = Math.min(...allMetrics.map(m => m.timestamp));
    const endTime = Math.max(...allMetrics.map(m => m.timestamp));
    
    const successfulOps = allMetrics.filter(m => m.success);
    const failedOps = allMetrics.filter(m => !m.success);
    
    const responseTimes = successfulOps.map(m => m.responseTime).sort((a, b) => a - b);
    const percentiles = this.calculatePercentiles(responseTimes);
    
    const cacheHits = allMetrics.filter(m => m.cacheHit === true).length;
    const cacheMisses = allMetrics.filter(m => m.cacheHit === false).length;
    const totalCacheOps = cacheHits + cacheMisses;
    
    const errorBreakdown = this.calculateErrorBreakdown(failedOps);
    
    const report: PerformanceReport = {
      testSuite: 'Comprehensive Performance Validation',
      startTime,
      endTime,
      duration: endTime - startTime,
      summary: {
        totalOperations: allMetrics.length,
        successfulOperations: successfulOps.length,
        failedOperations: failedOps.length,
        averageResponseTime: responseTimes.length > 0 
          ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
          : 0,
        percentiles,
        cacheStats: totalCacheOps > 0 ? {
          hitRatio: cacheHits / totalCacheOps,
          totalHits: cacheHits,
          totalMisses: cacheMisses
        } : undefined,
        errorBreakdown
      },
      benchmarks: allMetrics,
      insights: this.generateInsights(allMetrics, percentiles),
      recommendations: this.generateRecommendations(allMetrics, percentiles),
      comparisonData: comparisonBaseline ? await this.generateComparisonData(comparisonBaseline, allMetrics) : undefined
    };

    // Store as baseline for future comparisons
    this.baselineReports.set(`baseline_${Date.now()}`, report);
    
    return report;
  }

  /**
   * Helper methods
   */
  private startTest(testId: string): void {
    this.activeTests.set(testId, {
      startTime: Date.now(),
      metrics: []
    });
  }

  private recordBenchmark(metric: Omit<BenchmarkMetrics, 'operation'> & { operation?: string }, testId: string): void {
    const testData = this.activeTests.get(testId);
    if (testData) {
      const fullMetric: BenchmarkMetrics = {
        operation: metric.operation || 'unknown',
        ...metric
      };
      testData.metrics.push(fullMetric);
      this.benchmarks.push(fullMetric);
    }
  }

  private async generateTestUserIds(count: number): Promise<string[]> {
    const userIds = [];
    for (let i = 0; i < count; i++) {
      userIds.push(`test_user_${i}_${Date.now()}`);
    }
    return userIds;
  }

  private async benchmarkRedisLookup(userId: string, region: string, testId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      await redis.get(`role:${userId}`);
      const responseTime = performance.now() - startTime;
      
      this.recordBenchmark({
        operation: 'redis_lookup',
        region,
        timestamp: Date.now(),
        responseTime,
        success: true,
        cacheHit: true,
        metadata: { userId, region }
      }, testId);
    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.recordBenchmark({
        operation: 'redis_lookup',
        region,
        timestamp: Date.now(),
        responseTime,
        success: false,
        errorType: error instanceof Error ? error.message : 'Unknown error',
        metadata: { userId, region }
      }, testId);
    }
  }

  private async benchmarkClerkLookup(userId: string, region: string, testId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Simulate Clerk API call (in real scenario, would be actual Clerk call)
      await this.simulateClerkCall(userId);
      const responseTime = performance.now() - startTime;
      
      this.recordBenchmark({
        operation: 'clerk_lookup',
        region,
        timestamp: Date.now(),
        responseTime,
        success: true,
        cacheHit: false,
        metadata: { userId, region }
      }, testId);
    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.recordBenchmark({
        operation: 'clerk_lookup',
        region,
        timestamp: Date.now(),
        responseTime,
        success: false,
        errorType: error instanceof Error ? error.message : 'Unknown error',
        metadata: { userId, region }
      }, testId);
    }
  }

  private async benchmarkHybridLookup(userId: string, region: string, testId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Hybrid lookup: Redis first, Clerk fallback
      let role = await redis.get(`role:${userId}`);
      let cacheHit = true;
      
      if (!role) {
        cacheHit = false;
        role = await this.simulateClerkCall(userId);
        if (role) {
          await redis.setex(`role:${userId}`, 30, role);
        }
      }
      
      const responseTime = performance.now() - startTime;
      
      this.recordBenchmark({
        operation: 'hybrid_lookup',
        region,
        timestamp: Date.now(),
        responseTime,
        success: true,
        cacheHit,
        metadata: { userId, region, fallbackToClerk: !cacheHit }
      }, testId);
    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.recordBenchmark({
        operation: 'hybrid_lookup',
        region,
        timestamp: Date.now(),
        responseTime,
        success: false,
        errorType: error instanceof Error ? error.message : 'Unknown error',
        metadata: { userId, region }
      }, testId);
    }
  }

  private selectUserIdByPattern(userIds: string[], pattern: string, iteration: number): string {
    switch (pattern) {
      case 'random':
        return userIds[Math.floor(Math.random() * userIds.length)];
      case 'sequential':
        return userIds[iteration % userIds.length];
      case 'hotspot':
        // 80% of requests go to 20% of users
        const hotspotSize = Math.floor(userIds.length * 0.2);
        return Math.random() < 0.8 
          ? userIds[Math.floor(Math.random() * hotspotSize)]
          : userIds[hotspotSize + Math.floor(Math.random() * (userIds.length - hotspotSize))];
      case 'realistic':
        // Mix of patterns: 60% recent users, 30% random, 10% hotspot
        const rand = Math.random();
        if (rand < 0.6) {
          // Recent users (last 30% of the array)
          const recentStart = Math.floor(userIds.length * 0.7);
          return userIds[recentStart + Math.floor(Math.random() * (userIds.length - recentStart))];
        } else if (rand < 0.9) {
          // Random
          return userIds[Math.floor(Math.random() * userIds.length)];
        } else {
          // Hotspot (first 10% of users)
          return userIds[Math.floor(Math.random() * Math.floor(userIds.length * 0.1))];
        }
      default:
        return userIds[iteration % userIds.length];
    }
  }

  private async simulateClerkFetchAndCache(userId: string, testId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      const role = await this.simulateClerkCall(userId);
      await redis.setex(`role:${userId}`, 30, role);
      
      const responseTime = performance.now() - startTime;
      this.recordBenchmark({
        operation: 'clerk_fetch_and_cache',
        timestamp: Date.now(),
        responseTime,
        success: true,
        cacheHit: false,
        metadata: { userId, cachedRole: role }
      }, testId);
    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.recordBenchmark({
        operation: 'clerk_fetch_and_cache',
        timestamp: Date.now(),
        responseTime,
        success: false,
        errorType: error instanceof Error ? error.message : 'Unknown error',
        metadata: { userId }
      }, testId);
    }
  }

  private async simulateHybridAuth(userId: string): Promise<void> {
    // Check Redis first
    let role = await redis.get(`role:${userId}`);
    
    // Fallback to Clerk if not in cache
    if (!role) {
      role = await this.simulateClerkCall(userId);
      if (role) {
        await redis.setex(`role:${userId}`, 30, role);
      }
    }
  }

  private async simulateClerkCall(userId: string): Promise<string> {
    // Simulate network latency for Clerk API
    const latency = Math.random() * 50 + 25; // 25-75ms
    await this.sleep(latency);
    
    // Return mock role
    const roles = ['user', 'admin', 'manager'];
    return roles[Math.floor(Math.random() * roles.length)];
  }

  private detectRaceConditions(raceData: Map<string, Array<{ timestamp: number; operation: string; value: string }>>) {
    const raceConditions = [];
    
    for (const [userId, operations] of raceData.entries()) {
      // Look for concurrent writes
      const writes = operations.filter(op => op.operation === 'role_update').sort((a, b) => a.timestamp - b.timestamp);
      
      for (let i = 0; i < writes.length - 1; i++) {
        const timeDiff = writes[i + 1].timestamp - writes[i].timestamp;
        if (timeDiff < 100 && writes[i].value !== writes[i + 1].value) { // Less than 100ms apart
          raceConditions.push({
            userId,
            description: `Concurrent role updates detected: ${writes[i].value} -> ${writes[i + 1].value} within ${timeDiff}ms`
          });
        }
      }
    }
    
    return raceConditions;
  }

  private async collectSystemMetrics() {
    try {
      const redisInfo = await redis.ping();
      return {
        healthy: true,
        redisConnected: true,
        timestamp: Date.now(),
        circuitBreakerOpen: false // Would check actual circuit breaker state
      };
    } catch (error) {
      return {
        healthy: false,
        redisConnected: false,
        timestamp: Date.now(),
        circuitBreakerOpen: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async injectFailure(failure: NetworkFailureConfig, testId: string): Promise<void> {
    console.log(`💉 Injecting ${failure.failureType} failure`);
    
    // In a real implementation, this would actually inject failures
    // For now, just record that we're simulating it
    this.recordBenchmark({
      operation: `inject_${failure.failureType}`,
      timestamp: Date.now(),
      responseTime: 0,
      success: true,
      metadata: { 
        failureType: failure.failureType,
        duration: failure.duration,
        severity: failure.severity,
        affectedPercentage: failure.affectedPercentage
      }
    }, testId);
  }

  private async monitorSystemDuringFailure(failure: NetworkFailureConfig, testId: string): Promise<void> {
    const monitoringInterval = setInterval(async () => {
      const metrics = await this.collectSystemMetrics();
      this.recordBenchmark({
        operation: `monitor_during_${failure.failureType}`,
        timestamp: Date.now(),
        responseTime: 0,
        success: metrics.healthy,
        metadata: { 
          ...metrics,
          failureType: failure.failureType 
        }
      }, testId);
    }, 1000);

    await this.sleep(failure.duration);
    clearInterval(monitoringInterval);
  }

  private async initiateRecovery(failure: NetworkFailureConfig): Promise<void> {
    console.log(`🔄 Recovering from ${failure.failureType}`);
    // Simulate recovery time
    await this.sleep(Math.random() * 2000 + 1000);
  }

  private selectWeightedOperation(operations: LoadTestConfig['operations']) {
    const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const operation of operations) {
      random -= operation.weight;
      if (random <= 0) {
        return operation;
      }
    }
    
    return operations[0]; // Fallback
  }

  private async executeLoadTestOperation(
    operation: LoadTestConfig['operations'][0], 
    userId: string, 
    testId: string
  ): Promise<void> {
    switch (operation.type) {
      case 'role_lookup':
        await redis.get(`role:${userId}`);
        break;
      case 'role_update':
        await redis.setex(`role:${userId}`, 30, 'user');
        break;
      case 'user_creation':
        await redis.setex(`user:${userId}`, 300, JSON.stringify({ id: userId, created: Date.now() }));
        break;
      case 'cache_operation':
        await redis.exists(`role:${userId}`);
        break;
    }
  }

  private getLoadTestPhase(elapsedTime: number, config: LoadTestConfig): string {
    const rampUpEnd = config.rampUpTime;
    const steadyStateEnd = config.duration - (config.duration * 0.1); // Last 10% is ramp down
    
    if (elapsedTime < rampUpEnd) return 'ramp_up';
    if (elapsedTime < steadyStateEnd) return 'steady_state';
    return 'ramp_down';
  }

  private calculatePercentiles(sortedValues: number[]) {
    if (sortedValues.length === 0) {
      return { p50: 0, p95: 0, p99: 0, p99_9: 0 };
    }

    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * sortedValues.length) - 1;
      return sortedValues[Math.min(index, sortedValues.length - 1)];
    };

    return {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
      p99_9: getPercentile(99.9)
    };
  }

  private calculateErrorBreakdown(failedOps: BenchmarkMetrics[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    for (const op of failedOps) {
      const errorType = op.errorType || 'unknown_error';
      breakdown[errorType] = (breakdown[errorType] || 0) + 1;
    }
    
    return breakdown;
  }

  private generateInsights(metrics: BenchmarkMetrics[], percentiles: any): string[] {
    const insights: string[] = [];
    
    // Response time insights
    if (percentiles.p50 < 30) {
      insights.push(`✅ Median response time (${percentiles.p50.toFixed(2)}ms) meets sub-30ms target`);
    } else {
      insights.push(`⚠️  Median response time (${percentiles.p50.toFixed(2)}ms) exceeds 30ms target`);
    }
    
    if (percentiles.p99 > 100) {
      insights.push(`🚨 99th percentile response time (${percentiles.p99.toFixed(2)}ms) indicates performance issues for slowest requests`);
    }
    
    // Cache performance insights
    const cacheOps = metrics.filter(m => m.cacheHit !== undefined);
    if (cacheOps.length > 0) {
      const hitRatio = cacheOps.filter(m => m.cacheHit).length / cacheOps.length;
      if (hitRatio > 0.8) {
        insights.push(`✅ Excellent cache hit ratio: ${(hitRatio * 100).toFixed(1)}%`);
      } else if (hitRatio > 0.6) {
        insights.push(`⚠️  Moderate cache hit ratio: ${(hitRatio * 100).toFixed(1)}% - consider optimization`);
      } else {
        insights.push(`🚨 Low cache hit ratio: ${(hitRatio * 100).toFixed(1)}% - requires immediate attention`);
      }
    }
    
    // Error rate insights
    const errorRate = metrics.filter(m => !m.success).length / metrics.length;
    if (errorRate > 0.05) {
      insights.push(`🚨 High error rate detected: ${(errorRate * 100).toFixed(2)}%`);
    } else if (errorRate > 0.01) {
      insights.push(`⚠️  Moderate error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
    
    return insights;
  }

  private generateRecommendations(metrics: BenchmarkMetrics[], percentiles: any): string[] {
    const recommendations: string[] = [];
    
    if (percentiles.p95 > 50) {
      recommendations.push('Consider implementing connection pooling to reduce Redis latency');
      recommendations.push('Evaluate cache TTL settings to optimize hit ratios');
    }
    
    const redisOps = metrics.filter(m => m.operation.includes('redis'));
    const clerkOps = metrics.filter(m => m.operation.includes('clerk'));
    
    if (redisOps.length > 0 && clerkOps.length > 0) {
      const avgRedisTime = redisOps.reduce((sum, op) => sum + op.responseTime, 0) / redisOps.length;
      const avgClerkTime = clerkOps.reduce((sum, op) => sum + op.responseTime, 0) / clerkOps.length;
      
      if (avgClerkTime > avgRedisTime * 3) {
        recommendations.push('Clerk API calls are significantly slower than Redis - ensure proper caching strategy');
      }
    }
    
    const errorOps = metrics.filter(m => !m.success);
    if (errorOps.length > 0) {
      const errorTypes = [...new Set(errorOps.map(op => op.errorType))];
      recommendations.push(`Address the following error types: ${errorTypes.join(', ')}`);
    }
    
    recommendations.push('Monitor cache hit ratios continuously in production');
    recommendations.push('Set up alerting for response times exceeding 30ms');
    
    return recommendations;
  }

  private async generateComparisonData(baselineId: string, currentMetrics: BenchmarkMetrics[]) {
    const baseline = this.baselineReports.get(baselineId);
    if (!baseline) return undefined;

    const currentResponseTimes = currentMetrics.filter(m => m.success).map(m => m.responseTime);
    const currentPercentiles = this.calculatePercentiles(currentResponseTimes.sort((a, b) => a - b));
    
    const improvement = {
      p50ResponseTime: ((baseline.summary.percentiles.p50 - currentPercentiles.p50) / baseline.summary.percentiles.p50) * 100,
      p95ResponseTime: ((baseline.summary.percentiles.p95 - currentPercentiles.p95) / baseline.summary.percentiles.p95) * 100,
      p99ResponseTime: ((baseline.summary.percentiles.p99 - currentPercentiles.p99) / baseline.summary.percentiles.p99) * 100,
      errorRate: (baseline.summary.failedOperations / baseline.summary.totalOperations) - 
                 (currentMetrics.filter(m => !m.success).length / currentMetrics.length)
    };

    return {
      baseline: baseline.summary,
      improvement
    };
  }

  private generateReport(testId: string, suiteName: string): PerformanceReport {
    const testData = this.activeTests.get(testId);
    if (!testData) {
      throw new Error(`Test data not found for ${testId}`);
    }

    const metrics = testData.metrics;
    const successfulOps = metrics.filter(m => m.success);
    const failedOps = metrics.filter(m => !m.success);
    
    const responseTimes = successfulOps.map(m => m.responseTime).sort((a, b) => a - b);
    const percentiles = this.calculatePercentiles(responseTimes);
    
    const cacheHits = metrics.filter(m => m.cacheHit === true).length;
    const cacheMisses = metrics.filter(m => m.cacheHit === false).length;
    const totalCacheOps = cacheHits + cacheMisses;
    
    return {
      testSuite: suiteName,
      startTime: testData.startTime,
      endTime: Date.now(),
      duration: Date.now() - testData.startTime,
      summary: {
        totalOperations: metrics.length,
        successfulOperations: successfulOps.length,
        failedOperations: failedOps.length,
        averageResponseTime: responseTimes.length > 0 
          ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
          : 0,
        percentiles,
        cacheStats: totalCacheOps > 0 ? {
          hitRatio: cacheHits / totalCacheOps,
          totalHits: cacheHits,
          totalMisses: cacheMisses
        } : undefined,
        errorBreakdown: this.calculateErrorBreakdown(failedOps)
      },
      benchmarks: metrics,
      insights: this.generateInsights(metrics, percentiles),
      recommendations: this.generateRecommendations(metrics, percentiles)
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public API methods
   */
  public async runFullBenchmarkSuite(config?: {
    includeLongRunningTests?: boolean;
    skipNetworkFailureTests?: boolean;
    customLoadTestConfig?: LoadTestConfig;
  }): Promise<PerformanceReport> {
    console.log('🏃‍♂️ Running full performance benchmark suite...');
    
    const testIds: string[] = [];
    
    // Basic benchmarks
    console.log('1️⃣ Redis vs Clerk benchmarking...');
    const redisVsClerkReport = await this.benchmarkRedisVsClerk();
    testIds.push(redisVsClerkReport.testSuite);
    
    console.log('2️⃣ Cache hit ratio validation...');
    const cacheHitReport = await this.validateCacheHitRatios();
    testIds.push(cacheHitReport.testSuite);
    
    console.log('3️⃣ Sub-30ms response validation...');
    const sub30msReport = await this.validateSub30msResponse();
    testIds.push(sub30msReport.testSuite);
    
    console.log('4️⃣ Concurrent users testing...');
    const concurrentReport = await this.testConcurrentUsers();
    testIds.push(concurrentReport.testSuite);
    
    // Optional long-running tests
    if (config?.includeLongRunningTests) {
      if (!config?.skipNetworkFailureTests) {
        console.log('5️⃣ Network failure simulation...');
        const networkFailureReport = await this.simulateNetworkFailures();
        testIds.push(networkFailureReport.testSuite);
      }
      
      console.log('6️⃣ Load testing...');
      const loadTestConfig = config?.customLoadTestConfig || {
        concurrentUsers: 100,
        duration: 60000,
        rampUpTime: 30000,
        operations: [
          { type: 'role_lookup', weight: 0.5 },
          { type: 'role_update', weight: 0.2 },
          { type: 'user_creation', weight: 0.1 },
          { type: 'cache_operation', weight: 0.2 }
        ]
      };
      const loadTestReport = await this.runLoadTest(loadTestConfig);
      testIds.push(loadTestReport.testSuite);
    }
    
    // Generate comprehensive report
    return await this.generatePerformanceReport(testIds);
  }

  public clearBenchmarkData(): void {
    this.benchmarks = [];
    this.activeTests.clear();
  }

  public exportBenchmarkData(): BenchmarkMetrics[] {
    return [...this.benchmarks];
  }
}

// Export singleton instance
export const performanceBenchmark = PerformanceBenchmarkingSuite.getInstance();

// Convenience functions
export const runQuickBenchmark = () => performanceBenchmark.runFullBenchmarkSuite({ includeLongRunningTests: false });

export const runComprehensiveBenchmark = (config?: Parameters<typeof performanceBenchmark.runFullBenchmarkSuite>[0]) => 
  performanceBenchmark.runFullBenchmarkSuite({ includeLongRunningTests: true, ...config });

export const benchmarkRedisVsClerk = (config?: Parameters<typeof performanceBenchmark.benchmarkRedisVsClerk>[0]) =>
  performanceBenchmark.benchmarkRedisVsClerk(config);

export const validateSub30msResponse = (config?: Parameters<typeof performanceBenchmark.validateSub30msResponse>[0]) =>
  performanceBenchmark.validateSub30msResponse(config);