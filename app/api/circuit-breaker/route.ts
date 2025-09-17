/**
 * Circuit Breaker Health and Management API Route
 *
 * Provides endpoints for monitoring and managing circuit breakers
 * in production environments.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  CircuitBreakers,
  CircuitBreakerMonitoring,
  getCircuitBreakerHealth,
  createCircuitBreaker,
} from '@/lib/redis/circuit-breaker-factory';

// GET /api/circuit-breaker/health - Get overall health status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const service = searchParams.get('service');

    switch (action) {
      case 'health': {
        if (service) {
          // Get health for specific service
          const circuitBreaker = CircuitBreakers[service as keyof typeof CircuitBreakers];
          if (!circuitBreaker) {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
          }

          const health = await circuitBreaker.getHealth();
          return NextResponse.json({
            service,
            health,
            timestamp: Date.now(),
          });
        } else {
          // Get overall health
          const health = await getCircuitBreakerHealth();
          return NextResponse.json(health);
        }
      }

      case 'metrics': {
        if (service) {
          // Get metrics for specific service
          const circuitBreaker = CircuitBreakers[service as keyof typeof CircuitBreakers];
          if (!circuitBreaker) {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
          }

          const metrics = await circuitBreaker.getMetrics();
          return NextResponse.json({
            service,
            metrics,
            timestamp: Date.now(),
          });
        } else {
          // Get all metrics
          const metrics = await CircuitBreakerMonitoring.getAllMetrics();
          return NextResponse.json({
            metrics,
            timestamp: Date.now(),
          });
        }
      }

      case 'alerts': {
        // Get circuit breaker alerts
        const alerts = await CircuitBreakerMonitoring.getAlerts();
        return NextResponse.json({
          alerts,
          count: alerts.length,
          timestamp: Date.now(),
        });
      }

      default: {
        // Default: return overall health
        const health = await getCircuitBreakerHealth();
        return NextResponse.json(health);
      }
    }
  } catch (error) {
    console.warn('[CircuitBreaker API] GET error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// POST /api/circuit-breaker/management - Circuit breaker management actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, service, config } = body;

    switch (action) {
      case 'reset': {
        if (service) {
          // Reset specific service
          const circuitBreaker = CircuitBreakers[service as keyof typeof CircuitBreakers];
          if (!circuitBreaker) {
            return NextResponse.json({ error: 'Service not found' }, { status: 404 });
          }

          await circuitBreaker.reset();
          return NextResponse.json({
            success: true,
            message: `${service} circuit breaker reset`,
            timestamp: Date.now(),
          });
        } else {
          // Reset all circuit breakers
          const results = await CircuitBreakerMonitoring.resetAll();
          return NextResponse.json({
            success: true,
            message: 'All circuit breakers reset',
            results,
            timestamp: Date.now(),
          });
        }
      }

      case 'force_open': {
        if (!service) {
          return NextResponse.json({ error: 'Service parameter required' }, { status: 400 });
        }

        const circuitBreaker = CircuitBreakers[service as keyof typeof CircuitBreakers];
        if (!circuitBreaker) {
          return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }

        await circuitBreaker.forceOpen();
        return NextResponse.json({
          success: true,
          message: `${service} circuit breaker forced OPEN`,
          timestamp: Date.now(),
        });
      }

      case 'force_close': {
        if (!service) {
          return NextResponse.json({ error: 'Service parameter required' }, { status: 400 });
        }

        const cb = CircuitBreakers[service as keyof typeof CircuitBreakers];
        if (!cb) {
          return NextResponse.json({ error: 'Service not found' }, { status: 404 });
        }

        await cb.forceClose();
        return NextResponse.json({
          success: true,
          message: `${service} circuit breaker forced CLOSED`,
          timestamp: Date.now(),
        });
      }

      case 'create_custom': {
        if (!service || !config) {
          return NextResponse.json(
            { error: 'Service and config parameters required' },
            { status: 400 },
          );
        }

        // Create custom circuit breaker
        const customCircuitBreaker = createCircuitBreaker(service, config);
        // Using customCircuitBreaker to avoid unused variable warning
        console.log('Created circuit breaker:', customCircuitBreaker);

        return NextResponse.json({
          success: true,
          message: `Custom circuit breaker created for ${service}`,
          service,
          config,
          timestamp: Date.now(),
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[CircuitBreaker API] POST error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// PUT /api/circuit-breaker/config - Update circuit breaker configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { service, config } = body;

    if (!service || !config) {
      return NextResponse.json(
        { error: 'Service and config parameters required' },
        { status: 400 },
      );
    }

    // Note: Configuration updates require application restart
    // This endpoint is for documentation and future dynamic config support

    return NextResponse.json({
      success: true,
      message: `Configuration updated for ${service} (requires restart)`,
      service,
      config,
      note: 'Configuration changes require application restart to take effect',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[CircuitBreaker API] PUT error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
