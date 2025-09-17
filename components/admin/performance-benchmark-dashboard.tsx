'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { IconWrapper } from '@/lib/icon-wrapper';
import {
  Play,
  RefreshCw,
  Activity,
  Zap,
  Users,
  Database,
  Network,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Monitor,
} from 'lucide-react';

interface BenchmarkStatus {
  isRunning: boolean;
  totalBenchmarks: number;
  recentActivity: {
    lastHour: number;
    operations: string[];
    averageResponseTime: number;
  };
  systemHealth: {
    redis: string;
    clerk: string;
    circuitBreaker: string;
  };
}

interface BenchmarkResult {
  success: boolean;
  report?: Record<string, unknown>;
  analysis?: Record<string, unknown>;
  insights?: Record<string, unknown>;
  concurrencyAnalysis?: Record<string, unknown>;
  loadAnalysis?: Record<string, unknown>;
  resilienceAnalysis?: Record<string, unknown>;
  executiveSummary?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: string;
}

interface TestConfiguration {
  redisVsClerk: {
    regions: string[];
    iterations: number;
  };
  cacheHitRatio: {
    patterns: Array<{
      name: string;
      userCount: number;
      operationsPerUser: number;
      accessPattern: 'random' | 'hotspot' | 'realistic' | 'sequential';
    }>;
  };
  sub30ms: {
    sampleSize: number;
    operations: string[];
    strictMode: boolean;
  };
  concurrentUsers: {
    concurrentUsers: number;
    operationsPerUser: number;
    testDuration: number;
    raceConditionDetection: boolean;
  };
  loadTest: {
    concurrentUsers: number;
    duration: number;
    rampUpTime: number;
  };
}

export function PerformanceBenchmarkDashboard() {
  const [status, setStatus] = useState<BenchmarkStatus | null>(null);
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, BenchmarkResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [config] = useState<TestConfiguration>({
    redisVsClerk: {
      regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
      iterations: 100,
    },
    cacheHitRatio: {
      patterns: [
        { name: 'Random Access', userCount: 100, operationsPerUser: 50, accessPattern: 'random' },
        {
          name: 'Hotspot (80/20)',
          userCount: 100,
          operationsPerUser: 50,
          accessPattern: 'hotspot',
        },
        {
          name: 'Realistic Pattern',
          userCount: 200,
          operationsPerUser: 25,
          accessPattern: 'realistic',
        },
      ],
    },
    sub30ms: {
      sampleSize: 1000,
      operations: ['redis_lookup', 'cache_hit', 'hybrid_auth'],
      strictMode: false,
    },
    concurrentUsers: {
      concurrentUsers: 50,
      operationsPerUser: 20,
      testDuration: 60000,
      raceConditionDetection: true,
    },
    loadTest: {
      concurrentUsers: 100,
      duration: 60000,
      rampUpTime: 30000,
    },
  });

  // Fetch benchmark status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/performance/benchmark/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  }, []);

  // Run benchmark test
  const runBenchmark = async (testType: string, endpoint: string, testConfig?: Record<string, unknown>) => {
    setActiveTest(testType);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/performance/benchmark/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testConfig || {}),
      });

      const result = await response.json();

      setTestResults((prev) => ({
        ...prev,
        [testType]: result,
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setTestResults((prev) => ({
        ...prev,
        [testType]: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }));
    } finally {
      setActiveTest(null);
      setLoading(false);
      fetchStatus(); // Refresh status after test
    }
  };

  // Auto-refresh status
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const getBenchmarkIcon = (testType: string) => {
    switch (testType) {
      case 'redisVsClerk':
        return <IconWrapper icon={Database} className="h-5 w-5" />;
      case 'cacheHitRatio':
        return <IconWrapper icon={Activity} className="h-5 w-5" />;
      case 'sub30ms':
        return <IconWrapper icon={Zap} className="h-5 w-5" />;
      case 'concurrentUsers':
        return <IconWrapper icon={Users} className="h-5 w-5" />;
      case 'loadTest':
        return <IconWrapper icon={TrendingUp} className="h-5 w-5" />;
      case 'networkFailures':
        return <IconWrapper icon={Network} className="h-5 w-5" />;
      default:
        return <IconWrapper icon={BarChart3} className="h-5 w-5" />;
    }
  };

  const getResultStatus = (result?: BenchmarkResult) => {
    if (!result) return null;
    if (!result.success) return <IconWrapper icon={XCircle} className="h-4 w-4 text-red-500" />;
    return <IconWrapper icon={CheckCircle} className="h-4 w-4 text-green-500" />;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Performance Benchmarking</h2>
          <p className="text-muted-foreground">
            Validate hybrid authentication performance and system resilience
          </p>
        </div>
        <Button onClick={fetchStatus} variant="outline" disabled={loading}>
          <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4" />
          Refresh Status
        </Button>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconWrapper icon={Monitor} className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="bg-muted flex items-center justify-between rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">Tests Running</p>
                  <p className="text-2xl font-bold">{status.isRunning ? '1' : '0'}</p>
                </div>
                <div
                  className={`h-3 w-3 rounded-full ${status.isRunning ? 'animate-pulse bg-green-500' : 'bg-gray-300'}`}
                />
              </div>

              <div className="bg-muted flex items-center justify-between rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">Total Benchmarks</p>
                  <p className="text-2xl font-bold">{status.totalBenchmarks}</p>
                </div>
                <IconWrapper icon={Activity} className="h-6 w-6 text-blue-500" />
              </div>

              <div className="bg-muted flex items-center justify-between rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">Last Hour Activity</p>
                  <p className="text-2xl font-bold">{status.recentActivity.lastHour}</p>
                </div>
                <IconWrapper icon={TrendingUp} className="h-6 w-6 text-green-500" />
              </div>

              <div className="bg-muted flex items-center justify-between rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">Avg Response Time</p>
                  <p className="text-2xl font-bold">
                    {status.recentActivity.averageResponseTime.toFixed(1)}ms
                  </p>
                </div>
                <IconWrapper icon={Zap} className="h-6 w-6 text-yellow-500" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          )}

          {/* System Health */}
          {status && (
            <div className="mt-4 flex gap-2">
              <Badge variant={status.systemHealth.redis === 'healthy' ? 'default' : 'destructive'}>
                Redis: {status.systemHealth.redis}
              </Badge>
              <Badge variant={status.systemHealth.clerk === 'healthy' ? 'default' : 'destructive'}>
                Clerk: {status.systemHealth.clerk}
              </Badge>
              <Badge
                variant={
                  status.systemHealth.circuitBreaker === 'closed' ? 'default' : 'destructive'
                }
              >
                Circuit Breaker: {status.systemHealth.circuitBreaker}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <IconWrapper icon={AlertTriangle} className="h-4 w-4" />
          <AlertTitle>Test Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Benchmark Tests */}
      <Tabs defaultValue="individual" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="individual">Individual Tests</TabsTrigger>
          <TabsTrigger value="suite">Full Test Suite</TabsTrigger>
        </TabsList>

        <TabsContent value="individual">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Redis vs Clerk Benchmark */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getBenchmarkIcon('redisVsClerk')}
                  Redis vs Clerk
                  {getResultStatus(testResults.redisVsClerk)}
                </CardTitle>
                <CardDescription>Compare response times across regions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    onClick={() =>
                      runBenchmark('redisVsClerk', 'redis-vs-clerk', config.redisVsClerk)
                    }
                    disabled={loading || activeTest !== null}
                    className="w-full"
                  >
                    {activeTest === 'redisVsClerk' ? (
                      <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconWrapper icon={Play} className="mr-2 h-4 w-4" />
                    )}
                    Run Benchmark
                  </Button>

                  {testResults.redisVsClerk?.success && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Median Response:</span>
                        <span className="font-mono">
                          {testResults.redisVsClerk.insights?.medianResponseTime?.toFixed(2)}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cache Advantage:</span>
                        <span className="font-mono">
                          {testResults.redisVsClerk.insights?.cacheAdvantage?.toFixed(2)}ms
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cache Hit Ratio */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getBenchmarkIcon('cacheHitRatio')}
                  Cache Hit Ratio
                  {getResultStatus(testResults.cacheHitRatio)}
                </CardTitle>
                <CardDescription>Validate cache performance patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    onClick={() =>
                      runBenchmark('cacheHitRatio', 'cache-hit-ratio', config.cacheHitRatio)
                    }
                    disabled={loading || activeTest !== null}
                    className="w-full"
                  >
                    {activeTest === 'cacheHitRatio' ? (
                      <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconWrapper icon={Play} className="mr-2 h-4 w-4" />
                    )}
                    Test Cache
                  </Button>

                  {testResults.cacheHitRatio?.success && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Overall Hit Ratio:</span>
                        <span className="font-mono">
                          {(
                            (testResults.cacheHitRatio.analysis?.overallHitRatio || 0) * 100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                      <Progress
                        value={(testResults.cacheHitRatio.analysis?.overallHitRatio || 0) * 100}
                        className="h-2"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sub-30ms Validation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getBenchmarkIcon('sub30ms')}
                  Sub-30ms Response
                  {getResultStatus(testResults.sub30ms)}
                </CardTitle>
                <CardDescription>Validate response time claims</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    onClick={() => runBenchmark('sub30ms', 'sub-30ms', config.sub30ms)}
                    disabled={loading || activeTest !== null}
                    className="w-full"
                  >
                    {activeTest === 'sub30ms' ? (
                      <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconWrapper icon={Play} className="mr-2 h-4 w-4" />
                    )}
                    Validate Speed
                  </Button>

                  {testResults.sub30ms?.success && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Compliance Rate:</span>
                        <span className="font-mono">
                          {testResults.sub30ms.analysis?.complianceRate?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>P50 Response:</span>
                        <span className="font-mono">
                          {testResults.sub30ms.analysis?.medianTime?.toFixed(2)}ms
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Concurrent Users */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getBenchmarkIcon('concurrentUsers')}
                  Concurrent Users
                  {getResultStatus(testResults.concurrentUsers)}
                </CardTitle>
                <CardDescription>Test with race condition detection</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    onClick={() =>
                      runBenchmark('concurrentUsers', 'concurrent-users', config.concurrentUsers)
                    }
                    disabled={loading || activeTest !== null}
                    className="w-full"
                  >
                    {activeTest === 'concurrentUsers' ? (
                      <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconWrapper icon={Play} className="mr-2 h-4 w-4" />
                    )}
                    Test Concurrency
                  </Button>

                  {testResults.concurrentUsers?.success && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Operations:</span>
                        <span className="font-mono">
                          {testResults.concurrentUsers.concurrencyAnalysis?.totalOperations}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ops/Second:</span>
                        <span className="font-mono">
                          {testResults.concurrentUsers.concurrencyAnalysis?.operationsPerSecond?.toFixed(
                            1,
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Load Test */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getBenchmarkIcon('loadTest')}
                  Load Test
                  {getResultStatus(testResults.loadTest)}
                </CardTitle>
                <CardDescription>Comprehensive system load testing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    onClick={() => runBenchmark('loadTest', 'load-test', config.loadTest)}
                    disabled={loading || activeTest !== null}
                    className="w-full"
                  >
                    {activeTest === 'loadTest' ? (
                      <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconWrapper icon={Play} className="mr-2 h-4 w-4" />
                    )}
                    Run Load Test
                  </Button>

                  {testResults.loadTest?.success && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Peak Throughput:</span>
                        <span className="font-mono">
                          {testResults.loadTest.loadAnalysis?.peakPerformance?.sustainedThroughput?.toFixed(
                            1,
                          )}{' '}
                          ops/s
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>System Stability:</span>
                        <Badge
                          variant={
                            testResults.loadTest.loadAnalysis?.peakPerformance?.systemStability ===
                            'stable'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {testResults.loadTest.loadAnalysis?.peakPerformance?.systemStability}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Network Failures */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getBenchmarkIcon('networkFailures')}
                  Network Failures
                  {getResultStatus(testResults.networkFailures)}
                </CardTitle>
                <CardDescription>Simulate failures and test recovery</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button
                    onClick={() => runBenchmark('networkFailures', 'network-failures', {})}
                    disabled={loading || activeTest !== null}
                    className="w-full"
                    variant="destructive"
                  >
                    {activeTest === 'networkFailures' ? (
                      <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconWrapper icon={Play} className="mr-2 h-4 w-4" />
                    )}
                    Simulate Failures
                  </Button>

                  {testResults.networkFailures?.success && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Failure Scenarios:</span>
                        <span className="font-mono">
                          {testResults.networkFailures.resilienceAnalysis?.failureScenarios}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg Recovery Time:</span>
                        <span className="font-mono">
                          {testResults.networkFailures.resilienceAnalysis?.averageRecoveryTime?.toFixed(
                            2,
                          )}
                          ms
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suite">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconWrapper icon={BarChart3} className="h-5 w-5" />
                Full Benchmark Suite
                {getResultStatus(testResults.fullSuite)}
              </CardTitle>
              <CardDescription>
                Run all performance tests in sequence with comprehensive analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  onClick={() =>
                    runBenchmark('fullSuite', 'full-suite', {
                      includeLongRunningTests: true,
                      skipNetworkFailureTests: false,
                    })
                  }
                  disabled={loading || activeTest !== null}
                  className="w-full"
                  size="lg"
                >
                  {activeTest === 'fullSuite' ? (
                    <IconWrapper icon={RefreshCw} className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <IconWrapper icon={Play} className="mr-2 h-4 w-4" />
                  )}
                  Run Full Suite
                </Button>

                {testResults.fullSuite?.success && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted rounded-lg p-4">
                        <h4 className="font-medium">Overall Score</h4>
                        <div className="text-2xl font-bold">
                          {testResults.fullSuite.executiveSummary?.overallScore}/100
                        </div>
                      </div>

                      <div className="bg-muted rounded-lg p-4">
                        <h4 className="font-medium">Total Duration</h4>
                        <div className="text-2xl font-bold">
                          {formatDuration(testResults.fullSuite.metadata?.totalTestDuration || 0)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 font-medium">Key Findings</h4>
                      <ul className="space-y-1 text-sm">
                        {testResults.fullSuite.executiveSummary?.keyFindings?.map(
                          (finding: string, index: number) => (
                            <li key={index} className="flex items-center gap-2">
                              <div className="h-1 w-1 rounded-full bg-current" />
                              {finding}
                            </li>
                          ),
                        )}
                      </ul>
                    </div>

                    <div>
                      <h4 className="mb-2 font-medium">Risk Assessment</h4>
                      <div className="flex gap-2">
                        {Object.entries(
                          testResults.fullSuite.executiveSummary?.riskAssessment || {},
                        ).map(([key, value]) => (
                          <Badge
                            key={key}
                            variant={
                              value === 'low'
                                ? 'default'
                                : value === 'medium'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                          >
                            {key}: {value as string}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
