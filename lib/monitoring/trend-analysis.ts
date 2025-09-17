/**
 * Advanced Cache Performance Trending Analysis System
 *
 * Provides comprehensive time-series analysis, anomaly detection, predictive analytics,
 * and trend forecasting for cache performance optimization.
 */

import { redis } from '@/lib/redis';
import { redisCircuitBreaker } from '@/lib/redis/circuit-breaker';
import {
  performanceMetrics,
  type PerformanceMetrics,
  type PerformanceTrend,
} from './performance-metrics';

export interface TrendPoint {
  timestamp: number;
  value: number;
  metadata?: {
    confidence?: number;
    outlier?: boolean;
    seasonal?: boolean;
  };
}

export interface TrendAnalysis {
  series: TrendPoint[];
  statistics: {
    mean: number;
    median: number;
    standardDeviation: number;
    variance: number;
    min: number;
    max: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    trendStrength: number; // 0-1
    seasonality?: {
      detected: boolean;
      period?: number; // in milliseconds
      amplitude?: number;
    };
  };
  anomalies: Array<{
    timestamp: number;
    value: number;
    severity: 'low' | 'medium' | 'high';
    type: 'spike' | 'drop' | 'gradual_change';
    description: string;
  }>;
  forecast: Array<{
    timestamp: number;
    predicted: number;
    confidence: { lower: number; upper: number };
    accuracy?: number;
  }>;
  insights: {
    summary: string;
    patterns: string[];
    recommendations: string[];
    riskAssessment: 'low' | 'medium' | 'high';
  };
}

export interface MetricTrends {
  latency: {
    p50: TrendAnalysis;
    p95: TrendAnalysis;
    p99: TrendAnalysis;
  };
  throughput: TrendAnalysis;
  hitRatio: TrendAnalysis;
  errorRate: TrendAnalysis;
  memoryUsage: TrendAnalysis;
}

export interface ComparativeTrends {
  timeFrame1: { start: number; end: number; label: string };
  timeFrame2: { start: number; end: number; label: string };
  comparison: {
    latencyImprovement: number; // percentage change
    throughputChange: number;
    hitRatioChange: number;
    errorRateChange: number;
    overallPerformanceChange: number;
    significantChanges: Array<{
      metric: string;
      change: number;
      significance: 'major' | 'moderate' | 'minor';
      impact: 'positive' | 'negative' | 'neutral';
    }>;
  };
}

export interface PredictiveInsights {
  nextHour: {
    expectedLatency: { p95: number; confidence: number };
    expectedThroughput: { value: number; confidence: number };
    expectedHitRatio: { value: number; confidence: number };
    riskFactors: Array<{
      factor: string;
      probability: number;
      impact: 'low' | 'medium' | 'high';
    }>;
  };
  nextDay: {
    peakHours: Array<{ hour: number; expectedLoad: number }>;
    recommendedActions: Array<{
      action: string;
      timing: number; // timestamp
      priority: 'low' | 'medium' | 'high';
    }>;
  };
}

class CacheTrendAnalyzer {
  private static instance: CacheTrendAnalyzer;
  private trendCache = new Map<string, { data: any; expires: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes

  private constructor() {
    this.startTrendCollection();
  }

  public static getInstance(): CacheTrendAnalyzer {
    if (!CacheTrendAnalyzer.instance) {
      CacheTrendAnalyzer.instance = new CacheTrendAnalyzer();
    }
    return CacheTrendAnalyzer.instance;
  }

  /**
   * Analyze comprehensive performance trends
   */
  public async analyzeMetricTrends(
    duration: '1h' | '6h' | '24h' | '7d' = '24h',
    granularity: '1m' | '5m' | '15m' | '1h' = '5m',
  ): Promise<MetricTrends> {
    const cacheKey = `trends:${duration}:${granularity}`;

    // Check cache first
    const cached = this.trendCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    try {
      const [latencyTrends, throughputData, hitRatioData, errorRateData, memoryData] =
        await Promise.all([
          this.analyzeLatencyTrends(duration, granularity),
          this.analyzeThroughputTrend(duration, granularity),
          this.analyzeHitRatioTrend(duration, granularity),
          this.analyzeErrorRateTrend(duration, granularity),
          this.analyzeMemoryTrend(duration, granularity),
        ]);

      const result: MetricTrends = {
        latency: latencyTrends,
        throughput: throughputData,
        hitRatio: hitRatioData,
        errorRate: errorRateData,
        memoryUsage: memoryData,
      };

      // Cache the result
      this.trendCache.set(cacheKey, {
        data: result,
        expires: Date.now() + this.CACHE_TTL,
      });

      return result;
    } catch (error) {
      console.error('Failed to analyze metric trends:', error);
      throw error;
    }
  }

  /**
   * Analyze latency trends for different percentiles
   */
  private async analyzeLatencyTrends(
    duration: string,
    granularity: string,
  ): Promise<MetricTrends['latency']> {
    const timeWindow = this.getTimeWindow(duration);
    const granularityMs = this.getGranularityMs(granularity);
    const now = Date.now();

    // Collect latency data points
    const p50Data: TrendPoint[] = [];
    const p95Data: TrendPoint[] = [];
    const p99Data: TrendPoint[] = [];

    for (let time = now - timeWindow; time <= now; time += granularityMs) {
      try {
        // Get latency data from Redis sorted sets
        const latencyValues = await this.getLatencyValuesForTimeWindow(time - granularityMs, time);

        if (latencyValues.length > 0) {
          const percentiles = this.calculatePercentiles(latencyValues);

          p50Data.push({ timestamp: time, value: percentiles.p50 });
          p95Data.push({ timestamp: time, value: percentiles.p95 });
          p99Data.push({ timestamp: time, value: percentiles.p99 });
        }
      } catch (error) {
        console.warn(`Failed to get latency data for time ${time}:`, error);
      }
    }

    return {
      p50: await this.analyzeTrendSeries(p50Data, 'Latency P50'),
      p95: await this.analyzeTrendSeries(p95Data, 'Latency P95'),
      p99: await this.analyzeTrendSeries(p99Data, 'Latency P99'),
    };
  }

  /**
   * Analyze throughput trends
   */
  private async analyzeThroughputTrend(
    duration: string,
    granularity: string,
  ): Promise<TrendAnalysis> {
    const timeWindow = this.getTimeWindow(duration);
    const granularityMs = this.getGranularityMs(granularity);
    const now = Date.now();

    const throughputData: TrendPoint[] = [];

    for (let time = now - timeWindow; time <= now; time += granularityMs) {
      try {
        const operations = await this.getOperationCountForTimeWindow(time - granularityMs, time);

        const throughput = operations / (granularityMs / 1000); // ops per second
        throughputData.push({ timestamp: time, value: throughput });
      } catch (error) {
        console.warn(`Failed to get throughput data for time ${time}:`, error);
      }
    }

    return this.analyzeTrendSeries(throughputData, 'Throughput');
  }

  /**
   * Analyze hit ratio trends
   */
  private async analyzeHitRatioTrend(
    duration: string,
    granularity: string,
  ): Promise<TrendAnalysis> {
    const timeWindow = this.getTimeWindow(duration);
    const granularityMs = this.getGranularityMs(granularity);
    const now = Date.now();

    const hitRatioData: TrendPoint[] = [];

    for (let time = now - timeWindow; time <= now; time += granularityMs) {
      try {
        const { hits, misses } = await this.getHitMissCountsForTimeWindow(
          time - granularityMs,
          time,
        );

        const total = hits + misses;
        const hitRatio = total > 0 ? hits / total : 0;
        hitRatioData.push({ timestamp: time, value: hitRatio });
      } catch (error) {
        console.warn(`Failed to get hit ratio data for time ${time}:`, error);
      }
    }

    return this.analyzeTrendSeries(hitRatioData, 'Hit Ratio');
  }

  /**
   * Analyze error rate trends
   */
  private async analyzeErrorRateTrend(
    duration: string,
    granularity: string,
  ): Promise<TrendAnalysis> {
    const timeWindow = this.getTimeWindow(duration);
    const granularityMs = this.getGranularityMs(granularity);
    const now = Date.now();

    const errorRateData: TrendPoint[] = [];

    for (let time = now - timeWindow; time <= now; time += granularityMs) {
      try {
        const { success, errors } = await this.getSuccessErrorCountsForTimeWindow(
          time - granularityMs,
          time,
        );

        const total = success + errors;
        const errorRate = total > 0 ? errors / total : 0;
        errorRateData.push({ timestamp: time, value: errorRate });
      } catch (error) {
        console.warn(`Failed to get error rate data for time ${time}:`, error);
      }
    }

    return this.analyzeTrendSeries(errorRateData, 'Error Rate');
  }

  /**
   * Analyze memory usage trends
   */
  private async analyzeMemoryTrend(duration: string, granularity: string): Promise<TrendAnalysis> {
    const timeWindow = this.getTimeWindow(duration);
    const granularityMs = this.getGranularityMs(granularity);
    const now = Date.now();

    const memoryData: TrendPoint[] = [];

    for (let time = now - timeWindow; time <= now; time += granularityMs) {
      try {
        // This would get memory usage from Redis INFO or monitoring data
        const memoryUsage = await this.getMemoryUsageForTimeWindow(time - granularityMs, time);

        memoryData.push({ timestamp: time, value: memoryUsage });
      } catch (error) {
        console.warn(`Failed to get memory data for time ${time}:`, error);
      }
    }

    return this.analyzeTrendSeries(memoryData, 'Memory Usage');
  }

  /**
   * Analyze a time series and provide comprehensive insights
   */
  private async analyzeTrendSeries(data: TrendPoint[], metricName: string): Promise<TrendAnalysis> {
    if (data.length === 0) {
      return this.getEmptyTrendAnalysis(metricName);
    }

    // Calculate basic statistics
    const values = data.map((d) => d.value);
    const statistics = this.calculateStatistics(values);

    // Detect anomalies
    const anomalies = this.detectAnomalies(data, statistics);

    // Generate forecast
    const forecast = this.generateForecast(data);

    // Detect seasonality
    const seasonality = this.detectSeasonality(data);

    // Generate insights
    const insights = this.generateInsights(data, statistics, anomalies, metricName);

    return {
      series: data,
      statistics: {
        ...statistics,
        seasonality,
      },
      anomalies,
      forecast,
      insights,
    };
  }

  /**
   * Calculate comprehensive statistics for a data series
   */
  private calculateStatistics(values: number[]): Omit<TrendAnalysis['statistics'], 'seasonality'> {
    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        standardDeviation: 0,
        variance: 0,
        min: 0,
        max: 0,
        trend: 'stable',
        trendStrength: 0,
      };
    }

    const sorted = values.slice().sort((a, b) => a - b);
    const n = values.length;

    // Basic statistics
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / n;
    const median =
      n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);
    const min = sorted[0];
    const max = sorted[n - 1];

    // Trend analysis using linear regression
    const { trend, trendStrength } = this.calculateTrendDirection(values);

    return {
      mean,
      median,
      standardDeviation,
      variance,
      min,
      max,
      trend,
      trendStrength,
    };
  }

  /**
   * Calculate trend direction and strength using linear regression
   */
  private calculateTrendDirection(values: number[]): {
    trend: 'increasing' | 'decreasing' | 'stable';
    trendStrength: number;
  } {
    if (values.length < 2) {
      return { trend: 'stable', trendStrength: 0 };
    }

    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);

    // Calculate linear regression slope
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((acc, val) => acc + val, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = xValues[i] - xMean;
      const yDiff = values[i] - yMean;
      numerator += xDiff * yDiff;
      denominator += xDiff * xDiff;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;

    // Determine trend direction and strength
    const slopeThreshold = Math.abs(yMean) * 0.01; // 1% of mean as threshold

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < slopeThreshold) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    // Strength is correlation coefficient
    const trendStrength = Math.abs(slope) / (yMean || 1);

    return { trend, trendStrength: Math.min(trendStrength, 1) };
  }

  /**
   * Detect anomalies in time series data
   */
  private detectAnomalies(
    data: TrendPoint[],
    statistics: Omit<TrendAnalysis['statistics'], 'seasonality'>,
  ): TrendAnalysis['anomalies'] {
    const anomalies: TrendAnalysis['anomalies'] = [];

    if (data.length < 3) return anomalies;

    // Z-score based anomaly detection
    const zThreshold = 2.5; // 2.5 standard deviations

    for (let i = 0; i < data.length; i++) {
      const value = data[i].value;
      const zScore = Math.abs((value - statistics.mean) / statistics.standardDeviation);

      if (zScore > zThreshold) {
        let type: 'spike' | 'drop' | 'gradual_change';
        let severity: 'low' | 'medium' | 'high';

        // Determine anomaly type
        if (value > statistics.mean + 2 * statistics.standardDeviation) {
          type = 'spike';
        } else if (value < statistics.mean - 2 * statistics.standardDeviation) {
          type = 'drop';
        } else {
          type = 'gradual_change';
        }

        // Determine severity
        if (zScore > 4) severity = 'high';
        else if (zScore > 3) severity = 'medium';
        else severity = 'low';

        anomalies.push({
          timestamp: data[i].timestamp,
          value,
          severity,
          type,
          description: `${type} detected: value ${value.toFixed(2)} is ${zScore.toFixed(1)} standard deviations from mean`,
        });
      }
    }

    return anomalies;
  }

  /**
   * Generate forecast using simple moving average and trend extrapolation
   */
  private generateForecast(data: TrendPoint[]): TrendAnalysis['forecast'] {
    if (data.length < 3) return [];

    const forecast: TrendAnalysis['forecast'] = [];
    const windowSize = Math.min(10, Math.floor(data.length / 3));

    // Use recent data for forecast
    const recentData = data.slice(-windowSize);
    const recentValues = recentData.map((d) => d.value);
    const recentMean = recentValues.reduce((acc, val) => acc + val, 0) / recentValues.length;
    const recentStd = Math.sqrt(
      recentValues.reduce((acc, val) => acc + Math.pow(val - recentMean, 2), 0) /
        recentValues.length,
    );

    // Calculate trend from recent data
    const { trend, trendStrength } = this.calculateTrendDirection(recentValues);
    const trendAdjustment =
      trend === 'increasing' ? trendStrength : trend === 'decreasing' ? -trendStrength : 0;

    // Generate forecast points
    const lastTimestamp = data[data.length - 1].timestamp;
    const timeInterval = data.length > 1 ? data[1].timestamp - data[0].timestamp : 300000; // 5 minutes default

    for (let i = 1; i <= 12; i++) {
      // Forecast next 12 periods
      const timestamp = lastTimestamp + i * timeInterval;
      const basePrediction = recentMean + trendAdjustment * recentMean * i * 0.1;

      // Add some uncertainty
      const uncertainty = recentStd * Math.sqrt(i) * 0.5;

      forecast.push({
        timestamp,
        predicted: basePrediction,
        confidence: {
          lower: basePrediction - uncertainty,
          upper: basePrediction + uncertainty,
        },
        accuracy: Math.max(0.5, 1 - i * 0.05), // Decreasing accuracy over time
      });
    }

    return forecast;
  }

  /**
   * Detect seasonality patterns
   */
  private detectSeasonality(data: TrendPoint[]): TrendAnalysis['statistics']['seasonality'] {
    if (data.length < 24) {
      // Need at least 24 data points
      return { detected: false };
    }

    // Simple seasonality detection using autocorrelation
    // This is a simplified approach - in production, you might use FFT or more sophisticated methods

    const values = data.map((d) => d.value);
    const mean = values.reduce((acc, val) => acc + val, 0) / values.length;

    // Test common periods (hourly, daily patterns)
    const testPeriods = [4, 12, 24, 48]; // For 5-minute granularity: 20min, 1h, 2h, 4h
    let bestPeriod = 0;
    let bestCorrelation = 0;

    for (const period of testPeriods) {
      if (period >= values.length) continue;

      let correlation = 0;
      let count = 0;

      for (let i = period; i < values.length; i++) {
        const current = values[i] - mean;
        const previous = values[i - period] - mean;
        correlation += current * previous;
        count++;
      }

      if (count > 0) {
        correlation /= count;
        if (Math.abs(correlation) > Math.abs(bestCorrelation)) {
          bestCorrelation = correlation;
          bestPeriod = period;
        }
      }
    }

    // Consider seasonality detected if correlation is strong enough
    if (Math.abs(bestCorrelation) > 0.3) {
      const timeInterval = data.length > 1 ? data[1].timestamp - data[0].timestamp : 300000;
      return {
        detected: true,
        period: bestPeriod * timeInterval,
        amplitude: Math.abs(bestCorrelation),
      };
    }

    return { detected: false };
  }

  /**
   * Generate insights and recommendations
   */
  private generateInsights(
    data: TrendPoint[],
    statistics: Omit<TrendAnalysis['statistics'], 'seasonality'>,
    anomalies: TrendAnalysis['anomalies'],
    metricName: string,
  ): TrendAnalysis['insights'] {
    const patterns: string[] = [];
    const recommendations: string[] = [];

    // Trend analysis
    if (statistics.trend === 'increasing') {
      if (
        metricName.toLowerCase().includes('latency') ||
        metricName.toLowerCase().includes('error')
      ) {
        patterns.push(
          `${metricName} is trending upward (${(statistics.trendStrength * 100).toFixed(1)}% strength)`,
        );
        recommendations.push(`Monitor ${metricName} closely as it's increasing`);
      } else {
        patterns.push(`${metricName} shows positive growth trend`);
      }
    } else if (statistics.trend === 'decreasing') {
      if (
        metricName.toLowerCase().includes('hit ratio') ||
        metricName.toLowerCase().includes('throughput')
      ) {
        patterns.push(
          `${metricName} is declining (${(statistics.trendStrength * 100).toFixed(1)}% strength)`,
        );
        recommendations.push(`Investigate causes of declining ${metricName}`);
      } else {
        patterns.push(`${metricName} shows improvement trend`);
      }
    } else {
      patterns.push(`${metricName} remains stable`);
    }

    // Volatility analysis
    const coefficientOfVariation = statistics.standardDeviation / (statistics.mean || 1);
    if (coefficientOfVariation > 0.5) {
      patterns.push(`High volatility detected (CV: ${coefficientOfVariation.toFixed(2)})`);
      recommendations.push('Consider investigating sources of variability');
    }

    // Anomaly analysis
    const highSeverityAnomalies = anomalies.filter((a) => a.severity === 'high').length;
    if (highSeverityAnomalies > 0) {
      patterns.push(`${highSeverityAnomalies} high-severity anomalies detected`);
      recommendations.push('Review and address high-severity anomalies');
    }

    // Risk assessment
    let riskAssessment: 'low' | 'medium' | 'high';
    if (highSeverityAnomalies > 3 || coefficientOfVariation > 1.0) {
      riskAssessment = 'high';
    } else if (highSeverityAnomalies > 1 || coefficientOfVariation > 0.3) {
      riskAssessment = 'medium';
    } else {
      riskAssessment = 'low';
    }

    // Generate summary
    const summary =
      `${metricName} analysis: ${statistics.trend} trend with ${riskAssessment} risk level. ` +
      `Mean: ${statistics.mean.toFixed(2)}, Range: ${statistics.min.toFixed(2)}-${statistics.max.toFixed(2)}.`;

    return {
      summary,
      patterns,
      recommendations,
      riskAssessment,
    };
  }

  /**
   * Helper methods for data retrieval
   */
  private async getLatencyValuesForTimeWindow(
    startTime: number,
    endTime: number,
  ): Promise<number[]> {
    try {
      const operations = ['get', 'set', 'del', 'exists'];
      const allValues: number[] = [];

      for (const op of operations) {
        const values = await redis.zrange(`perf:latency:${op}:1m`, startTime, endTime, {
          byScore: true,
        });
        allValues.push(...values.map((v: unknown) => parseFloat(v as string)));
      }

      return allValues;
    } catch (error) {
      console.warn('Failed to get latency values:', error);
      return [];
    }
  }

  private async getOperationCountForTimeWindow(
    startTime: number,
    endTime: number,
  ): Promise<number> {
    try {
      const timeSlot = Math.floor(startTime / 60000) * 60000;
      const count = await redis.get(`perf:ops:total:${timeSlot}`);
      return parseInt((count as string) || '0');
    } catch (error) {
      console.warn('Failed to get operation count:', error);
      return 0;
    }
  }

  private async getHitMissCountsForTimeWindow(
    startTime: number,
    endTime: number,
  ): Promise<{ hits: number; misses: number }> {
    // This would aggregate hit/miss counts from the cache analytics
    // For now, return mock data
    return { hits: 800, misses: 200 };
  }

  private async getSuccessErrorCountsForTimeWindow(
    startTime: number,
    endTime: number,
  ): Promise<{ success: number; errors: number }> {
    // This would aggregate success/error counts from operations
    // For now, return mock data
    return { success: 950, errors: 50 };
  }

  private async getMemoryUsageForTimeWindow(startTime: number, endTime: number): Promise<number> {
    // This would get actual memory usage metrics
    // For now, return mock data
    return Math.random() * 1024 * 1024 * 100; // Random memory usage up to 100MB
  }

  private calculatePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
    if (values.length === 0) return { p50: 0, p95: 0, p99: 0 };

    const sorted = values.slice().sort((a, b) => a - b);
    const len = sorted.length;

    const getPercentile = (p: number): number => {
      const index = Math.ceil((p / 100) * len) - 1;
      return sorted[Math.max(0, Math.min(index, len - 1))];
    };

    return {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
    };
  }

  private getTimeWindow(duration: string): number {
    const windows: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };
    return windows[duration] || windows['24h'];
  }

  private getGranularityMs(granularity: string): number {
    const granularities: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
    };
    return granularities[granularity] || granularities['5m'];
  }

  private getEmptyTrendAnalysis(metricName: string): TrendAnalysis {
    return {
      series: [],
      statistics: {
        mean: 0,
        median: 0,
        standardDeviation: 0,
        variance: 0,
        min: 0,
        max: 0,
        trend: 'stable',
        trendStrength: 0,
        seasonality: { detected: false },
      },
      anomalies: [],
      forecast: [],
      insights: {
        summary: `No data available for ${metricName} analysis`,
        patterns: [],
        recommendations: ['Ensure data collection is working properly'],
        riskAssessment: 'medium',
      },
    };
  }

  /**
   * Start periodic trend collection
   */
  private startTrendCollection(): void {
    // Clear cache every 5 minutes to ensure fresh data
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.trendCache.entries()) {
        if (value.expires < now) {
          this.trendCache.delete(key);
        }
      }
    }, 300000);
  }

  /**
   * Compare performance between two time periods
   */
  public async comparePerformancePeriods(
    period1: { start: number; end: number; label: string },
    period2: { start: number; end: number; label: string },
  ): Promise<ComparativeTrends> {
    try {
      // Get performance metrics for both periods
      // This would require extending the performance metrics to accept time ranges
      // For now, return mock comparison data

      const comparison = {
        latencyImprovement: -5.2, // 5.2% worse
        throughputChange: 12.3, // 12.3% better
        hitRatioChange: 2.1, // 2.1% better
        errorRateChange: -15.5, // 15.5% worse (negative is bad for error rate)
        overallPerformanceChange: -2.1, // 2.1% worse overall
        significantChanges: [
          {
            metric: 'throughput',
            change: 12.3,
            significance: 'moderate' as const,
            impact: 'positive' as const,
          },
          {
            metric: 'error_rate',
            change: -15.5,
            significance: 'major' as const,
            impact: 'negative' as const,
          },
        ],
      };

      return {
        timeFrame1: period1,
        timeFrame2: period2,
        comparison,
      };
    } catch (error) {
      console.error('Failed to compare performance periods:', error);
      throw error;
    }
  }

  /**
   * Generate predictive insights
   */
  public async generatePredictiveInsights(): Promise<PredictiveInsights> {
    try {
      // This would use the trend analysis to make predictions
      // For now, return mock predictive data

      return {
        nextHour: {
          expectedLatency: { p95: 450, confidence: 0.85 },
          expectedThroughput: { value: 520, confidence: 0.8 },
          expectedHitRatio: { value: 0.88, confidence: 0.9 },
          riskFactors: [
            {
              factor: 'Increasing traffic pattern detected',
              probability: 0.75,
              impact: 'medium',
            },
            {
              factor: 'Memory usage approaching threshold',
              probability: 0.4,
              impact: 'high',
            },
          ],
        },
        nextDay: {
          peakHours: [
            { hour: 9, expectedLoad: 1200 },
            { hour: 14, expectedLoad: 1100 },
            { hour: 20, expectedLoad: 950 },
          ],
          recommendedActions: [
            {
              action: 'Pre-warm cache before peak hours',
              timing: Date.now() + 3600000, // 1 hour from now
              priority: 'medium',
            },
            {
              action: 'Scale Redis memory if usage exceeds 80%',
              timing: Date.now() + 1800000, // 30 minutes from now
              priority: 'high',
            },
          ],
        },
      };
    } catch (error) {
      console.error('Failed to generate predictive insights:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const trendAnalyzer = CacheTrendAnalyzer.getInstance();

// Convenience functions
export const analyzeTrends = (
  duration?: Parameters<CacheTrendAnalyzer['analyzeMetricTrends']>[0],
) => trendAnalyzer.analyzeMetricTrends(duration);

export const comparePerformance = (
  period1: Parameters<CacheTrendAnalyzer['comparePerformancePeriods']>[0],
  period2: Parameters<CacheTrendAnalyzer['comparePerformancePeriods']>[1],
) => trendAnalyzer.comparePerformancePeriods(period1, period2);

export const getPredictiveInsights = () => trendAnalyzer.generatePredictiveInsights();
