/**
 * Performance Budget Monitoring
 *
 * Tracks and monitors performance metrics to ensure operations stay within
 * defined performance budgets. Provides alerting when budgets are exceeded.
 */

import { redis } from '@/lib/redis';
import { getTimeoutConfig } from './timeout-config';
import { gracefulDegradation } from './graceful-degradation-service';

export interface PerformanceMetric {
  operationName: string;
  service: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  errorType?: string;
  timeout?: boolean;
  fallbackUsed?: boolean;
}

export interface PerformanceBudget {
  service: string;
  operation: string;
  /** Maximum allowed P50 response time (ms) */
  p50Threshold: number;
  /** Maximum allowed P95 response time (ms) */
  p95Threshold: number;
  /** Maximum allowed P99 response time (ms) */
  p99Threshold: number;
  /** Maximum allowed error rate (0.0-1.0) */
  errorRateThreshold: number;
  /** Maximum allowed timeout rate (0.0-1.0) */
  timeoutRateThreshold: number;
  /** Sample window size for calculations */
  sampleWindow: number;
}

export interface BudgetViolation {
  budget: PerformanceBudget;
  violationType: 'p50' | 'p95' | 'p99' | 'error_rate' | 'timeout_rate';
  currentValue: number;
  threshold: number;
  timestamp: Date;
  severity: 'warning' | 'critical';
}

export interface PerformanceReport {
  service: string;
  operation: string;
  timeWindow: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeoutRequests: number;
  fallbackRequests: number;
  metrics: {
    p50: number;
    p95: number;
    p99: number;
    errorRate: number;
    timeoutRate: number;
    fallbackRate: number;
    averageLatency: number;
  };
  budgetStatus: 'healthy' | 'warning' | 'critical';
  violations: BudgetViolation[];
}

class PerformanceBudgetMonitor {
  private static instance: PerformanceBudgetMonitor;
  private metrics: PerformanceMetric[] = [];
  private budgets: Map<string, PerformanceBudget> = new Map();
  private violations: BudgetViolation[] = [];
  private readonly config = getTimeoutConfig();

  private constructor() {
    this.initializeDefaultBudgets();
    this.startPeriodicCleanup();
  }

  public static getInstance(): PerformanceBudgetMonitor {
    if (!PerformanceBudgetMonitor.instance) {
      PerformanceBudgetMonitor.instance = new PerformanceBudgetMonitor();
    }
    return PerformanceBudgetMonitor.instance;
  }

  /**
   * Initialize default performance budgets for all services
   */
  private initializeDefaultBudgets(): void {
    const defaultBudgets: PerformanceBudget[] = [
      // Redis budgets
      {
        service: 'redis',
        operation: 'fast',
        p50Threshold: 20,
        p95Threshold: 50,
        p99Threshold: 100,
        errorRateThreshold: 0.01,
        timeoutRateThreshold: 0.005,
        sampleWindow: 1000,
      },
      {
        service: 'redis',
        operation: 'standard',
        p50Threshold: 50,
        p95Threshold: 150,
        p99Threshold: 300,
        errorRateThreshold: 0.02,
        timeoutRateThreshold: 0.01,
        sampleWindow: 1000,
      },

      // Clerk budgets
      {
        service: 'clerk',
        operation: 'fast',
        p50Threshold: 200,
        p95Threshold: 500,
        p99Threshold: 1000,
        errorRateThreshold: 0.02,
        timeoutRateThreshold: 0.01,
        sampleWindow: 1000,
      },
      {
        service: 'clerk',
        operation: 'standard',
        p50Threshold: 500,
        p95Threshold: 1500,
        p99Threshold: 3000,
        errorRateThreshold: 0.03,
        timeoutRateThreshold: 0.02,
        sampleWindow: 1000,
      },

      // Database budgets
      {
        service: 'database',
        operation: 'fast',
        p50Threshold: 50,
        p95Threshold: 100,
        p99Threshold: 200,
        errorRateThreshold: 0.01,
        timeoutRateThreshold: 0.005,
        sampleWindow: 1000,
      },
      {
        service: 'database',
        operation: 'standard',
        p50Threshold: 200,
        p95Threshold: 800,
        p99Threshold: 1500,
        errorRateThreshold: 0.02,
        timeoutRateThreshold: 0.01,
        sampleWindow: 1000,
      },
    ];

    defaultBudgets.forEach((budget) => {
      const key = `${budget.service}:${budget.operation}`;
      this.budgets.set(key, budget);
    });
  }

  /**
   * Record a performance metric
   */
  public recordMetric(metric: PerformanceMetric): void {
    // Add to in-memory storage
    this.metrics.push(metric);

    // Persist to Redis for cross-instance sharing
    this.persistMetricToRedis(metric).catch((error) => {
      console.warn('Failed to persist performance metric to Redis:', error);
    });

    // Check for budget violations
    this.checkBudgetViolations(metric);

    // Cleanup old metrics if memory gets too large
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000); // Keep last 5000 metrics
    }
  }

  /**
   * Persist metric to Redis for sharing across instances
   */
  private async persistMetricToRedis(metric: PerformanceMetric): Promise<void> {
    const key = `performance_metrics:${new Date().toISOString().split('T')[0]}`;
    const metricData = JSON.stringify({
      ...metric,
      timestamp: metric.timestamp.toISOString(),
    });

    await redis.lpush(key, metricData);
    await redis.expire(key, 86400 * 7); // Keep for 7 days
  }

  /**
   * Check for budget violations after recording a metric
   */
  private checkBudgetViolations(newMetric: PerformanceMetric): void {
    // Find relevant budget
    const budgetKeys = [
      `${newMetric.service}:fast`,
      `${newMetric.service}:standard`,
      `${newMetric.service}:slow`,
    ];

    for (const budgetKey of budgetKeys) {
      const budget = this.budgets.get(budgetKey);
      if (!budget) continue;

      // Get recent metrics for this service/operation
      const recentMetrics = this.getRecentMetrics(
        newMetric.service,
        budget.operation,
        budget.sampleWindow,
      );

      if (recentMetrics.length < 10) continue; // Need sufficient sample size

      // Calculate current performance
      const report = this.generateReport(newMetric.service, budget.operation, '5m');

      // Check each threshold
      this.checkThresholds(budget, report);
    }
  }

  /**
   * Check performance thresholds and record violations
   */
  private checkThresholds(budget: PerformanceBudget, report: PerformanceReport): void {
    const violations: BudgetViolation[] = [];

    // Check P50 threshold
    if (report.metrics.p50 > budget.p50Threshold) {
      violations.push({
        budget,
        violationType: 'p50',
        currentValue: report.metrics.p50,
        threshold: budget.p50Threshold,
        timestamp: new Date(),
        severity: report.metrics.p50 > budget.p50Threshold * 1.5 ? 'critical' : 'warning',
      });
    }

    // Check P95 threshold
    if (report.metrics.p95 > budget.p95Threshold) {
      violations.push({
        budget,
        violationType: 'p95',
        currentValue: report.metrics.p95,
        threshold: budget.p95Threshold,
        timestamp: new Date(),
        severity: report.metrics.p95 > budget.p95Threshold * 1.5 ? 'critical' : 'warning',
      });
    }

    // Check P99 threshold
    if (report.metrics.p99 > budget.p99Threshold) {
      violations.push({
        budget,
        violationType: 'p99',
        currentValue: report.metrics.p99,
        threshold: budget.p99Threshold,
        timestamp: new Date(),
        severity: report.metrics.p99 > budget.p99Threshold * 1.5 ? 'critical' : 'warning',
      });
    }

    // Check error rate threshold
    if (report.metrics.errorRate > budget.errorRateThreshold) {
      violations.push({
        budget,
        violationType: 'error_rate',
        currentValue: report.metrics.errorRate,
        threshold: budget.errorRateThreshold,
        timestamp: new Date(),
        severity: report.metrics.errorRate > budget.errorRateThreshold * 2 ? 'critical' : 'warning',
      });
    }

    // Check timeout rate threshold
    if (report.metrics.timeoutRate > budget.timeoutRateThreshold) {
      violations.push({
        budget,
        violationType: 'timeout_rate',
        currentValue: report.metrics.timeoutRate,
        threshold: budget.timeoutRateThreshold,
        timestamp: new Date(),
        severity:
          report.metrics.timeoutRate > budget.timeoutRateThreshold * 2 ? 'critical' : 'warning',
      });
    }

    // Record violations
    violations.forEach((violation) => {
      this.violations.push(violation);
      this.alertOnViolation(violation);
    });
  }

  /**
   * Alert on performance budget violations
   */
  private alertOnViolation(violation: BudgetViolation): void {
    const message =
      `Performance budget violation: ${violation.budget.service}.${violation.budget.operation} ` +
      `${violation.violationType} is ${violation.currentValue} (threshold: ${violation.threshold})`;

    if (violation.severity === 'critical') {
      console.error('[CRITICAL] ' + message);
    } else {
      console.warn('[WARNING] ' + message);
    }

    // Could integrate with external alerting systems here
    this.sendToAlertingSystem(violation).catch((error) => {
      console.warn('Failed to send alert:', error);
    });
  }

  /**
   * Send alert to external system (Slack, email, etc.)
   */
  private async sendToAlertingSystem(violation: BudgetViolation): Promise<void> {
    // Implementation depends on your alerting setup
    // Example: send to Redis for webhook processing
    const alertKey = 'performance_alerts';
    const alertData = {
      type: 'performance_budget_violation',
      violation,
      timestamp: new Date().toISOString(),
    };

    await redis.lpush(alertKey, JSON.stringify(alertData));
  }

  /**
   * Get recent metrics for analysis
   */
  private getRecentMetrics(
    service: string,
    operation: string,
    windowMinutes: number,
  ): PerformanceMetric[] {
    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000);

    return this.metrics.filter(
      (metric) =>
        metric.service === service &&
        metric.operationName.includes(operation) &&
        metric.timestamp > cutoffTime,
    );
  }

  /**
   * Generate performance report for a service/operation
   */
  public generateReport(service: string, operation: string, timeWindow: string): PerformanceReport {
    const windowMinutes = this.parseTimeWindow(timeWindow);
    const metrics = this.getRecentMetrics(service, operation, windowMinutes);

    if (metrics.length === 0) {
      return this.createEmptyReport(service, operation, timeWindow);
    }

    const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
    const totalRequests = metrics.length;
    const successfulRequests = metrics.filter((m) => m.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const timeoutRequests = metrics.filter((m) => m.timeout).length;
    const fallbackRequests = metrics.filter((m) => m.fallbackUsed).length;

    const p50 = this.calculatePercentile(durations, 50);
    const p95 = this.calculatePercentile(durations, 95);
    const p99 = this.calculatePercentile(durations, 99);
    const errorRate = failedRequests / totalRequests;
    const timeoutRate = timeoutRequests / totalRequests;
    const fallbackRate = fallbackRequests / totalRequests;
    const averageLatency = durations.reduce((sum, d) => sum + d, 0) / durations.length;

    // Check budget status
    const budgetKey = `${service}:${operation}`;
    const budget = this.budgets.get(budgetKey);
    let budgetStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (budget) {
      const criticalViolations = [
        p95 > budget.p95Threshold * 1.5,
        p99 > budget.p99Threshold * 1.5,
        errorRate > budget.errorRateThreshold * 2,
        timeoutRate > budget.timeoutRateThreshold * 2,
      ].some(Boolean);

      const warningViolations = [
        p95 > budget.p95Threshold,
        p99 > budget.p99Threshold,
        errorRate > budget.errorRateThreshold,
        timeoutRate > budget.timeoutRateThreshold,
      ].some(Boolean);

      if (criticalViolations) {
        budgetStatus = 'critical';
      } else if (warningViolations) {
        budgetStatus = 'warning';
      }
    }

    // Get recent violations
    const recentViolations = this.violations.filter(
      (v) =>
        v.budget.service === service &&
        v.budget.operation === operation &&
        v.timestamp > new Date(Date.now() - windowMinutes * 60 * 1000),
    );

    return {
      service,
      operation,
      timeWindow,
      totalRequests,
      successfulRequests,
      failedRequests,
      timeoutRequests,
      fallbackRequests,
      metrics: {
        p50,
        p95,
        p99,
        errorRate,
        timeoutRate,
        fallbackRate,
        averageLatency,
      },
      budgetStatus,
      violations: recentViolations,
    };
  }

  /**
   * Calculate percentile from sorted array of durations
   */
  private calculatePercentile(sortedDurations: number[], percentile: number): number {
    if (sortedDurations.length === 0) return 0;

    const index = (percentile / 100) * (sortedDurations.length - 1);

    if (Number.isInteger(index)) {
      return sortedDurations[index];
    }

    const lower = sortedDurations[Math.floor(index)];
    const upper = sortedDurations[Math.ceil(index)];
    return lower + (upper - lower) * (index - Math.floor(index));
  }

  /**
   * Parse time window string to minutes
   */
  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([mhd])$/);
    if (!match) return 5; // Default 5 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'm':
        return value;
      case 'h':
        return value * 60;
      case 'd':
        return value * 60 * 24;
      default:
        return 5;
    }
  }

  /**
   * Create empty report for when no metrics are available
   */
  private createEmptyReport(
    service: string,
    operation: string,
    timeWindow: string,
  ): PerformanceReport {
    return {
      service,
      operation,
      timeWindow,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      fallbackRequests: 0,
      metrics: {
        p50: 0,
        p95: 0,
        p99: 0,
        errorRate: 0,
        timeoutRate: 0,
        fallbackRate: 0,
        averageLatency: 0,
      },
      budgetStatus: 'healthy',
      violations: [],
    };
  }

  /**
   * Get all performance reports
   */
  public getAllReports(timeWindow: string = '5m'): PerformanceReport[] {
    const services = ['redis', 'clerk', 'database'];
    const operations = ['fast', 'standard', 'slow'];
    const reports: PerformanceReport[] = [];

    for (const service of services) {
      for (const operation of operations) {
        const report = this.generateReport(service, operation, timeWindow);
        if (report.totalRequests > 0) {
          reports.push(report);
        }
      }
    }

    return reports;
  }

  /**
   * Get current violations
   */
  public getViolations(severity?: 'warning' | 'critical'): BudgetViolation[] {
    const recentViolations = this.violations.filter(
      (v) => v.timestamp > new Date(Date.now() - 60 * 60 * 1000), // Last hour
    );

    if (severity) {
      return recentViolations.filter((v) => v.severity === severity);
    }

    return recentViolations;
  }

  /**
   * Periodic cleanup of old data
   */
  private startPeriodicCleanup(): void {
    setInterval(
      () => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Clean up old metrics
        this.metrics = this.metrics.filter((m) => m.timestamp > oneDayAgo);

        // Clean up old violations
        this.violations = this.violations.filter((v) => v.timestamp > oneDayAgo);
      },
      60 * 60 * 1000,
    ); // Run every hour
  }

  /**
   * Health check for performance monitoring system
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      metricsCount: number;
      violationsCount: number;
      criticalViolations: number;
      recentMetrics: number;
      budgetsConfigured: number;
    };
  }> {
    const recentMetrics = this.metrics.filter(
      (m) => m.timestamp > new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
    );

    const violations = this.getViolations();
    const criticalViolations = violations.filter((v) => v.severity === 'critical').length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (criticalViolations > 0) {
      status = 'unhealthy';
    } else if (violations.length > 5) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        metricsCount: this.metrics.length,
        violationsCount: violations.length,
        criticalViolations,
        recentMetrics: recentMetrics.length,
        budgetsConfigured: this.budgets.size,
      },
    };
  }
}

/**
 * Singleton instance
 */
export const performanceMonitor = PerformanceBudgetMonitor.getInstance();

/**
 * Decorator to automatically track performance metrics
 */
export function trackPerformance(service: string, operationName: string) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const startTime = performance.now();
      let success = true;
      let errorType: string | undefined;
      let timeout = false;
      let fallbackUsed = false;

      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } catch (error) {
        success = false;

        if (error instanceof Error) {
          errorType = error.constructor.name;
          timeout = error.message.toLowerCase().includes('timeout');
          fallbackUsed = error.message.toLowerCase().includes('fallback');
        }

        throw error;
      } finally {
        const duration = performance.now() - startTime;

        performanceMonitor.recordMetric({
          operationName,
          service,
          duration,
          timestamp: new Date(),
          success,
          errorType,
          timeout,
          fallbackUsed,
        });
      }
    };

    return descriptor;
  };
}
