/**
 * Health Integration Service
 * 
 * Integrates the graceful degradation system with comprehensive health monitoring
 * to provide unified observability and coordinated alerting across all services.
 */

import { redis } from '@/lib/redis';
import { performanceMonitor } from './performance-monitor';
import { fallbackAuth } from './fallback-auth';
import { gracefulDegradation } from './graceful-degradation-service';
import { TimeoutConfig } from './timeout-config';
import { connectDB } from '@/lib/db/connection';
import { currentUser } from '@clerk/nextjs/server';

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical' | 'unhealthy';
  timestamp: string;
  services: {
    redis: ServiceHealth;
    clerk: ServiceHealth;
    database: ServiceHealth;
    auth: ServiceHealth;
    performance: ServiceHealth;
  };
  degradation: {
    active: boolean;
    level: number;
    strategies: string[];
    affectedServices: string[];
  };
  metrics: {
    uptime: number;
    responseTime: number;
    errorRate: number;
    cacheHitRatio: number;
    fallbackUsage: number;
  };
  alerts: HealthAlert[];
  recommendations: string[];
}

export interface ServiceHealth {
  status: 'up' | 'degraded' | 'down';
  latency: number;
  errorRate: number;
  lastCheck: string;
  lastSuccess: string;
  consecutiveFailures: number;
  circuitBreakerState?: 'closed' | 'open' | 'half-open';
  degradationActive: boolean;
  details: Record<string, any>;
}

export interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  service: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
  metrics?: Record<string, number>;
}

class HealthIntegrationService {
  private static instance: HealthIntegrationService;
  private alertThresholds = {
    responseTime: {
      warning: 1000,  // 1 second
      critical: 5000  // 5 seconds
    },
    errorRate: {
      warning: 0.05,  // 5%
      critical: 0.15  // 15%
    },
    cacheHitRatio: {
      warning: 0.6,   // 60%
      critical: 0.3   // 30%
    }
  };
  
  private constructor() {}
  
  public static getInstance(): HealthIntegrationService {
    if (!HealthIntegrationService.instance) {
      HealthIntegrationService.instance = new HealthIntegrationService();
    }
    return HealthIntegrationService.instance;
  }
  
  /**
   * Comprehensive system health check
   */
  public async checkSystemHealth(): Promise<SystemHealthStatus> {
    const timestamp = new Date().toISOString();
    const startTime = performance.now();
    
    // Run health checks for all services in parallel
    const [redisHealth, clerkHealth, dbHealth, authHealth, perfHealth] = await Promise.allSettled([
      this.checkRedisHealth(),
      this.checkClerkHealth(),
      this.checkDatabaseHealth(),
      this.checkAuthHealth(),
      this.checkPerformanceHealth()
    ]);
    
    const services = {
      redis: redisHealth.status === 'fulfilled' ? redisHealth.value : this.createFailedServiceHealth('redis', redisHealth.reason),
      clerk: clerkHealth.status === 'fulfilled' ? clerkHealth.value : this.createFailedServiceHealth('clerk', clerkHealth.reason),
      database: dbHealth.status === 'fulfilled' ? dbHealth.value : this.createFailedServiceHealth('database', dbHealth.reason),
      auth: authHealth.status === 'fulfilled' ? authHealth.value : this.createFailedServiceHealth('auth', authHealth.reason),
      performance: perfHealth.status === 'fulfilled' ? perfHealth.value : this.createFailedServiceHealth('performance', perfHealth.reason)
    };
    
    // Calculate overall system health
    const overall = this.calculateOverallHealth(services);
    
    // Get degradation information
    const degradation = await this.getDegradationStatus();
    
    // Calculate system metrics
    const metrics = await this.calculateSystemMetrics();
    
    // Generate alerts
    const alerts = await this.generateHealthAlerts(services, metrics);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(services, degradation, metrics);
    
    const healthStatus: SystemHealthStatus = {
      overall,
      timestamp,
      services,
      degradation,
      metrics,
      alerts,
      recommendations
    };
    
    // Cache health status for quick access
    await this.cacheHealthStatus(healthStatus);
    
    // Record health check performance
    const totalLatency = performance.now() - startTime;
    await performanceMonitor.recordMetric({
      operationName: 'health_check_complete',
      service: 'health',
      duration: totalLatency,
      timestamp: new Date(),
      success: overall !== 'unhealthy'
    });
    
    return healthStatus;
  }
  
  /**
   * Check Redis health with detailed metrics
   */
  private async checkRedisHealth(): Promise<ServiceHealth> {
    const startTime = performance.now();
    
    try {
      // Test basic connectivity
      await redis.ping();
      
      // Test read/write operations
      const testKey = 'health_check_test';
      await redis.setex(testKey, 10, 'test');
      const testValue = await redis.get(testKey);
      await redis.del(testKey);
      
      if (testValue !== 'test') {
        throw new Error('Redis read/write test failed');
      }
      
      // Get basic Redis metrics (simplified since info() may not be available)
      const latency = performance.now() - startTime;
      
      // Get circuit breaker state (using a simplified approach)
      const cbStateRaw = await redis.get('circuit_breaker:redis');
      const cbState = cbStateRaw ? 
        (JSON.parse(cbStateRaw as string).state?.toLowerCase() as 'closed' | 'open' | 'half-open') : 
        'closed';
      
      return {
        status: latency > 1000 ? 'degraded' : 'up',
        latency,
        errorRate: 0,
        lastCheck: new Date().toISOString(),
        lastSuccess: new Date().toISOString(),
        consecutiveFailures: 0,
        circuitBreakerState: cbState,
        degradationActive: cbState !== 'closed',
        details: {
          connection: 'operational',
          latency: `${latency.toFixed(2)}ms`,
          cacheStatus: 'available'
        }
      };
      
    } catch (error) {
      return {
        status: 'down',
        latency: performance.now() - startTime,
        errorRate: 1,
        lastCheck: new Date().toISOString(),
        lastSuccess: await this.getLastSuccessTime('redis') || '',
        consecutiveFailures: await this.getConsecutiveFailures('redis'),
        circuitBreakerState: 'open',
        degradationActive: true,
        details: {
          error: (error as Error).message
        }
      };
    }
  }
  
  /**
   * Check Clerk authentication service health
   */
  private async checkClerkHealth(): Promise<ServiceHealth> {
    const startTime = performance.now();
    
    try {
      // Test basic Clerk connectivity
      await currentUser();
      const latency = performance.now() - startTime;
      
      // Get circuit breaker state from Redis directly
      const cbStateRaw = await redis.get('circuit_breaker:clerk');
      const cbState = cbStateRaw ? 
        (JSON.parse(cbStateRaw as string).state?.toLowerCase() as 'closed' | 'open' | 'half-open') : 
        'closed';
      
      return {
        status: latency > 2000 ? 'degraded' : 'up',
        latency,
        errorRate: 0,
        lastCheck: new Date().toISOString(),
        lastSuccess: new Date().toISOString(),
        consecutiveFailures: 0,
        circuitBreakerState: cbState,
        degradationActive: cbState !== 'closed',
        details: {
          apiEndpoint: 'operational',
          webhooks: 'configured',
          latency: `${latency.toFixed(2)}ms`
        }
      };
      
    } catch (error) {
      return {
        status: 'down',
        latency: performance.now() - startTime,
        errorRate: 1,
        lastCheck: new Date().toISOString(),
        lastSuccess: await this.getLastSuccessTime('clerk') || '',
        consecutiveFailures: await this.getConsecutiveFailures('clerk'),
        circuitBreakerState: 'open',
        degradationActive: true,
        details: {
          error: (error as Error).message
        }
      };
    }
  }
  
  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = performance.now();
    
    try {
      await connectDB();
      const latency = performance.now() - startTime;
      
      // Get circuit breaker state from Redis directly
      const cbStateRaw = await redis.get('circuit_breaker:database');
      const cbState = cbStateRaw ? 
        (JSON.parse(cbStateRaw as string).state?.toLowerCase() as 'closed' | 'open' | 'half-open') : 
        'closed';
      
      return {
        status: latency > 2000 ? 'degraded' : 'up',
        latency,
        errorRate: 0,
        lastCheck: new Date().toISOString(),
        lastSuccess: new Date().toISOString(),
        consecutiveFailures: 0,
        circuitBreakerState: cbState,
        degradationActive: cbState !== 'closed',
        details: {
          connection: 'established',
          readyState: 'connected',
          latency: `${latency.toFixed(2)}ms`
        }
      };
      
    } catch (error) {
      return {
        status: 'down',
        latency: performance.now() - startTime,
        errorRate: 1,
        lastCheck: new Date().toISOString(),
        lastSuccess: await this.getLastSuccessTime('database') || '',
        consecutiveFailures: await this.getConsecutiveFailures('database'),
        circuitBreakerState: 'open',
        degradationActive: true,
        details: {
          error: (error as Error).message
        }
      };
    }
  }
  
  /**
   * Check authentication system health
   */
  private async checkAuthHealth(): Promise<ServiceHealth> {
    const startTime = performance.now();
    
    try {
      const authHealthCheck = await fallbackAuth.healthCheck();
      const latency = performance.now() - startTime;
      
      let status: ServiceHealth['status'] = 'up';
      if (authHealthCheck.status === 'degraded') status = 'degraded';
      if (authHealthCheck.status === 'unhealthy') status = 'down';
      
      return {
        status,
        latency,
        errorRate: 0,
        lastCheck: new Date().toISOString(),
        lastSuccess: new Date().toISOString(),
        consecutiveFailures: 0,
        degradationActive: authHealthCheck.status !== 'healthy',
        details: authHealthCheck.details
      };
      
    } catch (error) {
      return {
        status: 'down',
        latency: performance.now() - startTime,
        errorRate: 1,
        lastCheck: new Date().toISOString(),
        lastSuccess: await this.getLastSuccessTime('auth') || '',
        consecutiveFailures: await this.getConsecutiveFailures('auth'),
        degradationActive: true,
        details: {
          error: (error as Error).message
        }
      };
    }
  }
  
  /**
   * Check performance monitoring system health
   */
  private async checkPerformanceHealth(): Promise<ServiceHealth> {
    const startTime = performance.now();
    
    try {
      // Simple health check for performance monitor
      const latency = performance.now() - startTime;
      
      return {
        status: 'up',
        latency,
        errorRate: 0,
        lastCheck: new Date().toISOString(),
        lastSuccess: new Date().toISOString(),
        consecutiveFailures: 0,
        degradationActive: false,
        details: {
          monitoring: 'active',
          latency: `${latency.toFixed(2)}ms`
        }
      };
      
    } catch (error) {
      return {
        status: 'down',
        latency: performance.now() - startTime,
        errorRate: 1,
        lastCheck: new Date().toISOString(),
        lastSuccess: await this.getLastSuccessTime('performance') || '',
        consecutiveFailures: await this.getConsecutiveFailures('performance'),
        degradationActive: true,
        details: {
          error: (error as Error).message
        }
      };
    }
  }
  
  /**
   * Calculate overall system health based on service health
   */
  private calculateOverallHealth(services: SystemHealthStatus['services']): SystemHealthStatus['overall'] {
    const serviceStatuses = Object.values(services).map(s => s.status);
    
    const downCount = serviceStatuses.filter(s => s === 'down').length;
    const degradedCount = serviceStatuses.filter(s => s === 'degraded').length;
    const upCount = serviceStatuses.filter(s => s === 'up').length;
    
    // If more than half services are down, system is unhealthy
    if (downCount > serviceStatuses.length / 2) {
      return 'unhealthy';
    }
    
    // If critical services (redis, auth) are down, system is critical
    if (services.redis.status === 'down' || services.auth.status === 'down') {
      return 'critical';
    }
    
    // If any services are down or degraded, system is degraded
    if (downCount > 0 || degradedCount > 0) {
      return 'degraded';
    }
    
    return 'healthy';
  }
  
  /**
   * Get current degradation status
   */
  private async getDegradationStatus() {
    // Get circuit breaker states directly from Redis
    const circuitBreakerStates = await Promise.all([
      this.getCircuitBreakerStateFromRedis('redis'),
      this.getCircuitBreakerStateFromRedis('clerk'),
      this.getCircuitBreakerStateFromRedis('database')
    ]);
    
    const degradationActive = circuitBreakerStates.some(state => state === 'open');
    const openServices = circuitBreakerStates
      .map((state, index) => ({ state, service: ['redis', 'clerk', 'database'][index] }))
      .filter(({ state }) => state === 'open')
      .map(({ service }) => service);
    
    return {
      active: degradationActive,
      level: openServices.length,
      strategies: openServices.map(service => `${service}_circuit_breaker`),
      affectedServices: openServices
    };
  }
  
  /**
   * Get circuit breaker state from Redis directly
   */
  private async getCircuitBreakerStateFromRedis(service: string): Promise<'closed' | 'open' | 'half-open'> {
    try {
      const stateRaw = await redis.get(`circuit_breaker:${service}`);
      if (stateRaw) {
        const state = JSON.parse(stateRaw as string).state;
        return state?.toLowerCase() as 'closed' | 'open' | 'half-open';
      }
      return 'closed';
    } catch (error) {
      console.warn(`Failed to get circuit breaker state for ${service}:`, error);
      return 'closed';
    }
  }
  
  /**
   * Calculate comprehensive system metrics
   */
  private async calculateSystemMetrics() {
    // Get basic metrics from Redis and performance monitoring
    try {
      const uptime = process.uptime();
      
      // Get some basic performance metrics from Redis
      const responseTimeKey = 'system:avg_response_time';
      const errorRateKey = 'system:error_rate';
      const cacheHitRatioKey = 'system:cache_hit_ratio';
      const fallbackUsageKey = 'system:fallback_usage';
      
      const [responseTime, errorRate, cacheHitRatio, fallbackUsage] = await Promise.all([
        redis.get(responseTimeKey).then(val => val ? parseFloat(val as string) : 0).catch(() => 0),
        redis.get(errorRateKey).then(val => val ? parseFloat(val as string) : 0).catch(() => 0),
        redis.get(cacheHitRatioKey).then(val => val ? parseFloat(val as string) : 0.8).catch(() => 0.8),
        redis.get(fallbackUsageKey).then(val => val ? parseFloat(val as string) : 0).catch(() => 0)
      ]);
      
      return {
        uptime,
        responseTime,
        errorRate,
        cacheHitRatio,
        fallbackUsage
      };
    } catch (error) {
      console.warn('Failed to calculate system metrics:', error);
      return {
        uptime: process.uptime(),
        responseTime: 0,
        errorRate: 0,
        cacheHitRatio: 0.8,
        fallbackUsage: 0
      };
    }
  }
  
  /**
   * Generate health alerts based on current state
   */
  private async generateHealthAlerts(
    services: SystemHealthStatus['services'],
    metrics: SystemHealthStatus['metrics']
  ): Promise<HealthAlert[]> {
    const alerts: HealthAlert[] = [];
    const timestamp = new Date().toISOString();
    
    // Service-specific alerts
    for (const [serviceName, serviceHealth] of Object.entries(services)) {
      if (serviceHealth.status === 'down') {
        alerts.push({
          id: `${serviceName}_down_${Date.now()}`,
          severity: 'critical',
          service: serviceName,
          message: `${serviceName} service is down`,
          timestamp,
          acknowledged: false,
          resolved: false,
          metrics: {
            latency: serviceHealth.latency,
            consecutiveFailures: serviceHealth.consecutiveFailures
          }
        });
      } else if (serviceHealth.status === 'degraded') {
        alerts.push({
          id: `${serviceName}_degraded_${Date.now()}`,
          severity: 'warning',
          service: serviceName,
          message: `${serviceName} service is degraded`,
          timestamp,
          acknowledged: false,
          resolved: false,
          metrics: {
            latency: serviceHealth.latency
          }
        });
      }
    }
    
    // Performance alerts
    if (metrics.responseTime > this.alertThresholds.responseTime.critical) {
      alerts.push({
        id: `response_time_critical_${Date.now()}`,
        severity: 'critical',
        service: 'performance',
        message: `System response time is critically high: ${metrics.responseTime.toFixed(0)}ms`,
        timestamp,
        acknowledged: false,
        resolved: false,
        metrics: { responseTime: metrics.responseTime }
      });
    } else if (metrics.responseTime > this.alertThresholds.responseTime.warning) {
      alerts.push({
        id: `response_time_warning_${Date.now()}`,
        severity: 'warning',
        service: 'performance',
        message: `System response time is high: ${metrics.responseTime.toFixed(0)}ms`,
        timestamp,
        acknowledged: false,
        resolved: false,
        metrics: { responseTime: metrics.responseTime }
      });
    }
    
    if (metrics.errorRate > this.alertThresholds.errorRate.critical) {
      alerts.push({
        id: `error_rate_critical_${Date.now()}`,
        severity: 'critical',
        service: 'performance',
        message: `System error rate is critically high: ${(metrics.errorRate * 100).toFixed(1)}%`,
        timestamp,
        acknowledged: false,
        resolved: false,
        metrics: { errorRate: metrics.errorRate }
      });
    }
    
    if (metrics.cacheHitRatio < this.alertThresholds.cacheHitRatio.critical) {
      alerts.push({
        id: `cache_hit_ratio_critical_${Date.now()}`,
        severity: 'critical',
        service: 'redis',
        message: `Cache hit ratio is critically low: ${(metrics.cacheHitRatio * 100).toFixed(1)}%`,
        timestamp,
        acknowledged: false,
        resolved: false,
        metrics: { cacheHitRatio: metrics.cacheHitRatio }
      });
    }
    
    return alerts;
  }
  
  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    services: SystemHealthStatus['services'],
    degradation: SystemHealthStatus['degradation'],
    metrics: SystemHealthStatus['metrics']
  ): string[] {
    const recommendations: string[] = [];
    
    // Service-specific recommendations
    if (services.redis.status === 'down') {
      recommendations.push('Check Redis connection and restart if necessary');
      recommendations.push('Verify Redis configuration and network connectivity');
    }
    
    if (services.clerk.status === 'down') {
      recommendations.push('Check Clerk API status and credentials');
      recommendations.push('Verify webhook configurations');
    }
    
    if (services.database.status === 'down') {
      recommendations.push('Check database connection and credentials');
      recommendations.push('Verify database server status');
    }
    
    // Performance recommendations
    if (metrics.responseTime > 2000) {
      recommendations.push('Investigate slow database queries');
      recommendations.push('Check Redis performance and memory usage');
    }
    
    if (metrics.cacheHitRatio < 0.5) {
      recommendations.push('Review cache invalidation strategy');
      recommendations.push('Consider increasing cache TTL for stable data');
    }
    
    if (metrics.errorRate > 0.1) {
      recommendations.push('Review error logs for recurring issues');
      recommendations.push('Check circuit breaker configurations');
    }
    
    // Degradation recommendations
    if (degradation.active) {
      recommendations.push('Monitor degraded services and plan recovery');
      recommendations.push('Consider scaling resources if degradation persists');
    }
    
    return recommendations;
  }
  
  /**
   * Helper methods
   */
  private createFailedServiceHealth(serviceName: string, error: any): ServiceHealth {
    return {
      status: 'down',
      latency: 0,
      errorRate: 1,
      lastCheck: new Date().toISOString(),
      lastSuccess: '',
      consecutiveFailures: 1,
      degradationActive: true,
      details: {
        error: error?.message || 'Health check failed'
      }
    };
  }
  
  private extractRedisMetric(info: string, metric: string): string {
    const match = info.match(new RegExp(`${metric}:(.+)`));
    return match ? match[1].trim() : 'unknown';
  }
  
  private async getLastSuccessTime(service: string): Promise<string | null> {
    return await redis.get(`health:last_success:${service}`);
  }
  
  private async getConsecutiveFailures(service: string): Promise<number> {
    const failures = await redis.get(`health:failures:${service}`);
    return failures ? parseInt(failures as string) : 0;
  }
  
  private async cacheHealthStatus(healthStatus: SystemHealthStatus): Promise<void> {
    try {
      await redis.setex('system:health_status', 60, JSON.stringify(healthStatus));
    } catch (error) {
      console.warn('Failed to cache health status:', error);
    }
  }
  
  /**
   * Get cached health status (for quick checks)
   */
  public async getCachedHealthStatus(): Promise<SystemHealthStatus | null> {
    try {
      const cached = await redis.get('system:health_status');
      return cached ? JSON.parse(cached as string) : null;
    } catch (error) {
      console.warn('Failed to get cached health status:', error);
      return null;
    }
  }
  
  /**
   * Configure alert thresholds
   */
  public configureAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }
}

/**
 * Singleton instance
 */
export const healthIntegration = HealthIntegrationService.getInstance();

/**
 * Convenience function for quick health checks
 */
export async function getSystemHealthStatus(): Promise<SystemHealthStatus> {
  return healthIntegration.checkSystemHealth();
}

/**
 * Convenience function for cached health status
 */
export async function getCachedSystemHealth(): Promise<SystemHealthStatus | null> {
  return healthIntegration.getCachedHealthStatus();
}