/**
 * Performance Testing API Endpoints
 * 
 * RESTful API endpoints for executing performance benchmarks and retrieving results
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceBenchmark, type LoadTestConfig } from '@/lib/testing/performance-benchmarking';
import { currentUser } from '@clerk/nextjs/server';

// Auth helper function for API endpoints
async function getAuthContext(request: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return { authenticated: false, role: null, userId: null };
    }
    
    const role = user.publicMetadata?.role as string || 'user';
    return {
      authenticated: true,
      role,
      userId: user.id
    };
  } catch (error) {
    console.error('Auth context error:', error);
    return { authenticated: false, role: null, userId: null };
  }
}

/**
 * POST /api/performance/benchmark/redis-vs-clerk
 * Benchmark Redis vs Clerk performance across regions
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const authContext = await getAuthContext(request);
    if (!authContext.authenticated || !['admin', 'manager'].includes(authContext.role!)) {
      return NextResponse.json({ 
        error: "Insufficient permissions. Admin or Manager role required." 
      }, { status: 403 });
    }

    const body = await request.json();
    const config = {
      regions: body.regions || ['us-east-1', 'us-west-2', 'eu-west-1'],
      iterations: body.iterations || 100,
      userIds: body.userIds
    };

    console.log('🚀 Starting Redis vs Clerk benchmark via API');
    const report = await performanceBenchmark.benchmarkRedisVsClerk(config);

    return NextResponse.json({
      success: true,
      report,
      insights: {
        medianResponseTime: report.summary.percentiles.p50,
        cacheAdvantage: report.benchmarks.filter(b => b.operation === 'redis_lookup' && b.success)
          .reduce((sum, b) => sum + b.responseTime, 0) / 
          report.benchmarks.filter(b => b.operation === 'redis_lookup' && b.success).length,
        clerkAverage: report.benchmarks.filter(b => b.operation === 'clerk_lookup' && b.success)
          .reduce((sum, b) => sum + b.responseTime, 0) / 
          report.benchmarks.filter(b => b.operation === 'clerk_lookup' && b.success).length
      }
    });

  } catch (error) {
    console.error('Redis vs Clerk benchmark failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/performance/benchmark/cache-hit-ratio
 * Validate cache hit ratios under different load patterns
 */
export async function validateCacheHitRatio(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext.authenticated || !['admin', 'manager'].includes(authContext.role!)) {
      return NextResponse.json({ 
        error: "Insufficient permissions" 
      }, { status: 403 });
    }

    const body = await request.json();
    
    const config = {
      patterns: body.patterns || [
        { name: 'Random Access', userCount: 100, operationsPerUser: 50, accessPattern: 'random' as const },
        { name: 'Hotspot (80/20)', userCount: 100, operationsPerUser: 50, accessPattern: 'hotspot' as const },
        { name: 'Realistic Pattern', userCount: 200, operationsPerUser: 25, accessPattern: 'realistic' as const }
      ]
    };

    console.log('🎯 Starting cache hit ratio validation via API');
    const report = await performanceBenchmark.validateCacheHitRatios(config);

    return NextResponse.json({
      success: true,
      report,
      analysis: {
        overallHitRatio: report.summary.cacheStats?.hitRatio || 0,
        patternAnalysis: config.patterns.map((pattern: { 
          name: string; 
          accessPattern: 'random' | 'hotspot' | 'realistic' | 'sequential'; 
        }) => ({
          name: pattern.name,
          expectedHitRatio: pattern.accessPattern === 'hotspot' ? 0.8 : 
                           pattern.accessPattern === 'realistic' ? 0.65 : 0.5,
          performanceImpact: pattern.accessPattern === 'hotspot' ? 'high' : 'medium'
        }))
      }
    });

  } catch (error) {
    console.error('Cache hit ratio validation failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/performance/benchmark/sub-30ms
 * Validate sub-30ms response time claims
 */
export async function validateSub30ms(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext.authenticated || !['admin', 'manager'].includes(authContext.role!)) {
      return NextResponse.json({ 
        error: "Insufficient permissions" 
      }, { status: 403 });
    }

    const body = await request.json();
    const config = {
      sampleSize: body.sampleSize || 1000,
      operations: (body.operations as string[]) || ['redis_lookup', 'cache_hit', 'hybrid_auth'],
      strictMode: body.strictMode || false
    };

    console.log('⚡ Starting sub-30ms validation via API');
    const report = await performanceBenchmark.validateSub30msResponse(config);

    // Calculate compliance metrics
    const sub30msOps = report.benchmarks.filter(b => b.success && b.responseTime <= 30);
    const complianceRate = sub30msOps.length / report.benchmarks.filter(b => b.success).length;
    
    const analysis = {
      complianceRate: complianceRate * 100,
      medianTime: report.summary.percentiles.p50,
      p95Time: report.summary.percentiles.p95,
      p99Time: report.summary.percentiles.p99,
      meetsTarget: report.summary.percentiles.p50 <= 30,
      operationBreakdown: config.operations.map((op: string) => {
        const opBenchmarks = report.benchmarks.filter(b => b.operation === op && b.success);
        const opSub30ms = opBenchmarks.filter(b => b.responseTime <= 30);
        return {
          operation: op,
          compliance: opSub30ms.length / opBenchmarks.length * 100,
          median: opBenchmarks.reduce((sum, b) => sum + b.responseTime, 0) / opBenchmarks.length
        };
      })
    };

    return NextResponse.json({
      success: true,
      report,
      analysis
    });

  } catch (error) {
    console.error('Sub-30ms validation failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/performance/benchmark/concurrent-users
 * Test concurrent user scenarios
 */
export async function testConcurrentUsers(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext.authenticated || !['admin', 'manager'].includes(authContext.role!)) {
      return NextResponse.json({ 
        error: "Insufficient permissions" 
      }, { status: 403 });
    }

    const body = await request.json();
    const config = {
      concurrentUsers: body.concurrentUsers || 50,
      operationsPerUser: body.operationsPerUser || 20,
      testDuration: body.testDuration || 60000,
      raceConditionDetection: body.raceConditionDetection ?? true
    };

    console.log('👥 Starting concurrent users test via API');
    const report = await performanceBenchmark.testConcurrentUsers(config);

    return NextResponse.json({
      success: true,
      report,
      concurrencyAnalysis: {
        totalOperations: report.summary.totalOperations,
        operationsPerSecond: report.summary.totalOperations / (report.duration / 1000),
        averageResponseTime: report.summary.averageResponseTime,
        concurrencyImpact: report.summary.percentiles.p95 > 100 ? 'high' : 
                          report.summary.percentiles.p95 > 50 ? 'medium' : 'low'
      }
    });

  } catch (error) {
    console.error('Concurrent users test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/performance/benchmark/load-test
 * Run comprehensive load test
 */
export async function runLoadTest(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext.authenticated || !['admin', 'manager'].includes(authContext.role!)) {
      return NextResponse.json({ 
        error: "Insufficient permissions" 
      }, { status: 403 });
    }

    const body = await request.json();
    const config: LoadTestConfig = {
      concurrentUsers: body.concurrentUsers || 100,
      duration: body.duration || 60000,
      rampUpTime: body.rampUpTime || 30000,
      operations: body.operations || [
        { type: 'role_lookup', weight: 0.5 },
        { type: 'role_update', weight: 0.2 },
        { type: 'user_creation', weight: 0.1 },
        { type: 'cache_operation', weight: 0.2 }
      ],
      regions: body.regions,
      cacheHitRatio: body.cacheHitRatio
    };

    console.log('🚀 Starting comprehensive load test via API');
    const report = await performanceBenchmark.runLoadTest(config);

    // Calculate load test specific metrics
    const rampUpOps = report.benchmarks.filter(b => 
      b.metadata?.loadTestPhase === 'ramp_up'
    );
    const steadyStateOps = report.benchmarks.filter(b => 
      b.metadata?.loadTestPhase === 'steady_state'
    );
    
    const loadAnalysis = {
      rampUpPhase: {
        operations: rampUpOps.length,
        averageResponseTime: rampUpOps.reduce((sum, b) => sum + b.responseTime, 0) / rampUpOps.length || 0,
        errorRate: rampUpOps.filter(b => !b.success).length / rampUpOps.length * 100
      },
      steadyState: {
        operations: steadyStateOps.length,
        averageResponseTime: steadyStateOps.reduce((sum, b) => sum + b.responseTime, 0) / steadyStateOps.length || 0,
        errorRate: steadyStateOps.filter(b => !b.success).length / steadyStateOps.length * 100,
        throughput: steadyStateOps.length / ((report.duration * 0.6) / 1000) // 60% of duration is steady state
      },
      peakPerformance: {
        maxConcurrentUsers: config.concurrentUsers,
        sustainedThroughput: report.summary.totalOperations / (report.duration / 1000),
        systemStability: report.summary.percentiles.p99 < 200 ? 'stable' : 'unstable'
      }
    };

    return NextResponse.json({
      success: true,
      report,
      loadAnalysis
    });

  } catch (error) {
    console.error('Load test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/performance/benchmark/network-failures
 * Simulate network failures and test recovery
 */
export async function simulateNetworkFailures(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext.authenticated || authContext.role !== 'admin') {
      return NextResponse.json({ 
        error: "Admin role required for network failure testing" 
      }, { status: 403 });
    }

    const body = await request.json();
    const config = {
      failures: body.failures || [
        { failureType: 'redis_down', duration: 10000, severity: 'high', affectedPercentage: 100 },
        { failureType: 'latency_spike', duration: 20000, severity: 'medium', affectedPercentage: 50 }
      ],
      recoveryValidation: body.recoveryValidation ?? true,
      circuitBreakerTesting: body.circuitBreakerTesting ?? true
    };

    console.log('🔥 Starting network failure simulation via API');
    const report = await performanceBenchmark.simulateNetworkFailures(config);

    return NextResponse.json({
      success: true,
      report,
      resilienceAnalysis: {
        failureScenarios: config.failures.length,
        averageRecoveryTime: report.benchmarks
          .filter(b => b.operation.includes('failure_recovery'))
          .reduce((sum, b) => sum + b.responseTime, 0) / 
          report.benchmarks.filter(b => b.operation.includes('failure_recovery')).length || 0,
        circuitBreakerEffectiveness: report.benchmarks
          .filter(b => b.metadata?.circuitBreakerTriggered).length > 0 ? 'effective' : 'needs_review'
      }
    });

  } catch (error) {
    console.error('Network failure simulation failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/performance/benchmark/full-suite
 * Run comprehensive benchmark suite
 */
export async function runFullSuite(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext.authenticated || !['admin', 'manager'].includes(authContext.role!)) {
      return NextResponse.json({ 
        error: "Insufficient permissions" 
      }, { status: 403 });
    }

    const body = await request.json();
    const config = {
      includeLongRunningTests: body.includeLongRunningTests || false,
      skipNetworkFailureTests: body.skipNetworkFailureTests || false,
      customLoadTestConfig: body.customLoadTestConfig
    };

    console.log('🏃‍♂️ Starting full benchmark suite via API');
    const report = await performanceBenchmark.runFullBenchmarkSuite(config);

    // Generate executive summary
    const executiveSummary = {
      overallScore: calculateOverallPerformanceScore(report),
      keyFindings: [
        `Median response time: ${report.summary.percentiles.p50.toFixed(2)}ms`,
        `Cache hit ratio: ${((report.summary.cacheStats?.hitRatio || 0) * 100).toFixed(1)}%`,
        `Error rate: ${((report.summary.failedOperations / report.summary.totalOperations) * 100).toFixed(2)}%`,
        `99th percentile: ${report.summary.percentiles.p99.toFixed(2)}ms`
      ],
      recommendations: report.recommendations.slice(0, 5), // Top 5 recommendations
      riskAssessment: {
        performance: report.summary.percentiles.p95 > 100 ? 'high' : 'low',
        reliability: (report.summary.failedOperations / report.summary.totalOperations) > 0.01 ? 'medium' : 'low',
        scalability: report.summary.cacheStats?.hitRatio && report.summary.cacheStats.hitRatio > 0.8 ? 'low' : 'medium'
      }
    };

    return NextResponse.json({
      success: true,
      report,
      executiveSummary,
      testConfiguration: config,
      metadata: {
        totalTestDuration: report.duration,
        totalOperations: report.summary.totalOperations,
        testCompletedAt: new Date(report.endTime).toISOString()
      }
    });

  } catch (error) {
    console.error('Full benchmark suite failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      partialResults: null // Could include partial results if available
    }, { status: 500 });
  }
}

/**
 * GET /api/performance/benchmark/status
 * Get current benchmark status and recent results
 */
export async function getBenchmarkStatus(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext.authenticated) {
      return NextResponse.json({ 
        error: "Authentication required" 
      }, { status: 401 });
    }

    const benchmarkData = performanceBenchmark.exportBenchmarkData();
    const recentBenchmarks = benchmarkData
      .filter(b => Date.now() - b.timestamp < 3600000) // Last hour
      .sort((a, b) => b.timestamp - a.timestamp);

    const status = {
      isRunning: recentBenchmarks.some(b => Date.now() - b.timestamp < 60000), // Active in last minute
      totalBenchmarks: benchmarkData.length,
      recentActivity: {
        lastHour: recentBenchmarks.length,
        operations: [...new Set(recentBenchmarks.map(b => b.operation))],
        averageResponseTime: recentBenchmarks.length > 0 
          ? recentBenchmarks.reduce((sum, b) => sum + b.responseTime, 0) / recentBenchmarks.length 
          : 0
      },
      systemHealth: {
        redis: 'healthy', // Would check actual Redis status
        clerk: 'healthy', // Would check actual Clerk status
        circuitBreaker: 'closed' // Would check actual circuit breaker status
      }
    };

    return NextResponse.json({
      success: true,
      status,
      recentBenchmarks: recentBenchmarks.slice(0, 50) // Limit to 50 recent results
    });

  } catch (error) {
    console.error('Failed to get benchmark status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Helper function to calculate overall performance score
 */
function calculateOverallPerformanceScore(report: any): number {
  let score = 100;
  
  // Response time impact (0-30 points)
  if (report.summary.percentiles.p50 > 30) score -= 15;
  if (report.summary.percentiles.p95 > 100) score -= 15;
  
  // Error rate impact (0-25 points)
  const errorRate = report.summary.failedOperations / report.summary.totalOperations;
  if (errorRate > 0.05) score -= 25;
  else if (errorRate > 0.01) score -= 10;
  
  // Cache performance impact (0-25 points)
  const hitRatio = report.summary.cacheStats?.hitRatio || 0;
  if (hitRatio < 0.6) score -= 25;
  else if (hitRatio < 0.8) score -= 10;
  
  // Throughput impact (0-20 points)
  const throughput = report.summary.totalOperations / (report.duration / 1000);
  if (throughput < 50) score -= 20;
  else if (throughput < 100) score -= 10;
  
  return Math.max(0, Math.min(100, score));
}