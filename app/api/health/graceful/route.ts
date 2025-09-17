/**
 * Graceful Degradation Health Check API Route
 * 
 * Provides comprehensive system health monitoring with graceful degradation integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { healthIntegration, getSystemHealthStatus, getCachedSystemHealth } from '@/lib/graceful-degradation/health-integration';

/**
 * GET /api/health/graceful - Enhanced system health check with degradation awareness
 */
export async function GET(request: NextRequest) {
  try {
    // Check if cached health status is acceptable
    const useCache = request.nextUrl.searchParams.get('cache') !== 'false';
    const includeRecommendations = request.nextUrl.searchParams.get('recommendations') === 'true';
    
    let healthStatus;
    
    if (useCache) {
      const cached = await getCachedSystemHealth();
      if (cached && Date.now() - new Date(cached.timestamp).getTime() < 30000) { // 30 seconds
        healthStatus = cached;
      }
    }
    
    // If no cached data or cache disabled, run full health check
    if (!healthStatus) {
      healthStatus = await getSystemHealthStatus();
    }

    // Build response
    const response = {
      overall: healthStatus.overall,
      timestamp: healthStatus.timestamp,
      services: healthStatus.services,
      degradation: healthStatus.degradation,
      metrics: healthStatus.metrics,
      alerts: healthStatus.alerts,
      ...(includeRecommendations && { recommendations: healthStatus.recommendations })
    };

    // Determine response status code based on health
    let statusCode = 200;
    switch (healthStatus.overall) {
      case 'unhealthy':
        statusCode = 503;
        break;
      case 'critical':
        statusCode = 500;
        break;
      case 'degraded':
        statusCode = 206; // Partial content
        break;
      default:
        statusCode = 200;
    }

    // Add additional headers for monitoring tools
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Status': healthStatus.overall,
      'X-Health-Timestamp': healthStatus.timestamp,
      'X-Degradation-Active': healthStatus.degradation.active.toString(),
      'X-Degradation-Level': healthStatus.degradation.level.toString()
    });

    // Add retry-after header for unhealthy responses
    if (statusCode >= 500) {
      headers.set('Retry-After', '60'); // 1 minute
    }

    return NextResponse.json(response, { 
      status: statusCode,
      headers 
    });

  } catch (error) {
    console.error('Graceful health check failed:', error);
    
    return NextResponse.json({
      overall: 'unhealthy',
      error: 'Health check system failure',
      timestamp: new Date().toISOString(),
      degradation: {
        active: true,
        level: 5,
        strategies: ['emergency_fallback'],
        affectedServices: ['health_system']
      },
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { 
      status: 503,
      headers: {
        'Retry-After': '120', // 2 minutes for system failures
        'X-Health-Status': 'unhealthy',
        'X-Degradation-Active': 'true'
      }
    });
  }
}

/**
 * POST /api/health/graceful/configure - Configure health monitoring settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Simple authentication check (in production, use proper auth)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Configure alert thresholds if provided
    if (body.alertThresholds) {
      healthIntegration.configureAlertThresholds(body.alertThresholds);
    }

    return NextResponse.json({
      success: true,
      message: 'Health monitoring configuration updated',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Health configuration failed:', error);
    
    return NextResponse.json({
      error: 'Configuration update failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * GET /api/health/graceful/summary - Quick health summary for dashboards
 */
export async function HEAD() {
  try {
    const cached = await getCachedSystemHealth();
    
    if (!cached) {
      return new NextResponse(null, {
        status: 503,
        headers: {
          'X-Health-Status': 'unknown',
          'X-Degradation-Active': 'true'
        }
      });
    }

    let statusCode = 200;
    switch (cached.overall) {
      case 'unhealthy':
        statusCode = 503;
        break;
      case 'critical':
        statusCode = 500;
        break;
      case 'degraded':
        statusCode = 206;
        break;
      default:
        statusCode = 200;
    }

    return new NextResponse(null, {
      status: statusCode,
      headers: {
        'X-Health-Status': cached.overall,
        'X-Health-Timestamp': cached.timestamp,
        'X-Degradation-Active': cached.degradation.active.toString(),
        'X-Degradation-Level': cached.degradation.level.toString(),
        'X-Alerts-Count': cached.alerts.length.toString(),
        'X-Affected-Services': cached.degradation.affectedServices.join(',')
      }
    });

  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        'X-Health-Status': 'error',
        'X-Degradation-Active': 'true'
      }
    });
  }
}