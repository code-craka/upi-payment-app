/**
 * Persistent Circuit Breaker Usage Examples
 *
 * This file demonstrates how to use the Redis-backed persistent circuit breaker
 * in various scenarios within the UPI Admin Dashboard.
 */

import { Redis } from '@upstash/redis';
import {
  PersistentCircuitBreaker,
  CircuitBreakers,
  createCircuitBreaker,
  withCircuitBreaker,
  CircuitBreakerMonitoring,
  getCircuitBreakerHealth
} from '@/lib/redis/circuit-breaker-factory';
import { CircuitBreakerError } from '@/lib/redis/persistent-circuit-breaker';

// Example 1: Basic Usage with Factory Function
export async function basicCircuitBreakerExample() {
  // Create a circuit breaker for a specific service
  const circuitBreaker = createCircuitBreaker('payment-service', {
    failureThreshold: 3,
    successThreshold: 2,
    recoveryTimeout: 30000,
  });

  try {
    const result = await circuitBreaker.execute(
      async () => {
        // Your Redis operation here
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });

        return await redis.get('some-key');
      },
      'fetch-payment-data'
    );

    console.log('Operation successful:', result);
    return result;
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      console.error('Circuit breaker error:', error.message);
      // Handle circuit breaker specific errors
      return null;
    }
    throw error;
  }
}

// Example 2: Using Pre-configured Circuit Breakers
export async function preConfiguredCircuitBreakerExample() {
  try {
    // Use the pre-configured Redis circuit breaker
    const result = await CircuitBreakers.redis.execute(async () => {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });

      return await redis.set('user:123', JSON.stringify({ name: 'John' }));
    });

    console.log('Redis operation successful');
    return result;
  } catch (error) {
    console.error('Redis operation failed:', error);
    return null;
  }
}

// Example 3: Circuit Breaker with Database Operations
export async function databaseCircuitBreakerExample() {
  try {
    const result = await CircuitBreakers.database.execute(async () => {
      // Simulate database operation
      const response = await fetch('/api/orders', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Database error: ${response.status}`);
      }

      return await response.json();
    }, 'fetch-orders');

    return result;
  } catch (error) {
    console.error('Database operation failed:', error);
    return [];
  }
}

// Example 4: Circuit Breaker with External API Calls
export async function externalApiCircuitBreakerExample() {
  try {
    const result = await CircuitBreakers.api.execute(async () => {
      // Simulate external API call
      const response = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 1000,
          currency: 'usd',
        }),
      });

      if (!response.ok) {
        throw new Error(`Stripe API error: ${response.status}`);
      }

      return await response.json();
    }, 'create-payment-intent');

    return result;
  } catch (error) {
    console.error('External API call failed:', error);
    return null;
  }
}

// Example 5: Using Circuit Breaker Middleware for API Routes
export const circuitBreakerProtectedRoute = withCircuitBreaker(
  async (request: Request) => {
    // Your API route logic here
    const data = await request.json();

    // Simulate processing
    const result = {
      id: 'order_123',
      status: 'processed',
      data,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  },
  'order-processing',
  {
    failureThreshold: 5,
    recoveryTimeout: 60000,
  }
);

// Example 6: Monitoring and Health Checks
export async function circuitBreakerMonitoringExample() {
  // Get overall health status
  const health = await getCircuitBreakerHealth();
  console.log('Circuit Breaker Health:', health);

  // Get detailed metrics for all services
  const metrics = await CircuitBreakerMonitoring.getAllMetrics();
  console.log('Circuit Breaker Metrics:', metrics);

  // Get alerts
  const alerts = await CircuitBreakerMonitoring.getAlerts();
  console.log('Circuit Breaker Alerts:', alerts);

  // Check specific service health
  const redisHealth = await CircuitBreakers.redis.getHealth();
  console.log('Redis Circuit Breaker Health:', redisHealth);

  return { health, metrics, alerts };
}

// Example 7: Custom Circuit Breaker with Advanced Configuration
export async function customCircuitBreakerExample() {
  const customCircuitBreaker = new PersistentCircuitBreaker(
    new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    }),
    {
      serviceName: 'custom-service',
      failureThreshold: 10,
      successThreshold: 5,
      recoveryTimeout: 120000,     // 2 minutes
      maxRecoveryTimeout: 600000,  // 10 minutes
      backoffMultiplier: 2,
      backoffJitter: 0.2,
      monitoringPeriod: 600000,    // 10 minutes
      stateTtl: 3600000,           // 1 hour
      metricsTtl: 86400000,        // 24 hours
    }
  );

  try {
    const result = await customCircuitBreaker.execute(async () => {
      // Your custom operation here
      return { success: true, data: 'Custom operation result' };
    }, 'custom-operation');

    return result;
  } catch (error) {
    console.error('Custom operation failed:', error);
    return null;
  }
}

// Example 8: Circuit Breaker State Management
export async function circuitBreakerStateManagementExample() {
  const circuitBreaker = CircuitBreakers.redis;

  // Check if circuit breaker is available
  const isAvailable = await circuitBreaker.isAvailable();
  console.log('Circuit breaker available:', isAvailable);

  // Get current state
  const state = await circuitBreaker.getCurrentState();
  console.log('Current state:', state);

  // Get metrics
  const metrics = await circuitBreaker.getMetrics();
  console.log('Metrics:', metrics);

  // Manual state management (admin operations)
  if (metrics.availability < 50) {
    console.log('Low availability detected, resetting circuit breaker');
    await circuitBreaker.reset();
  }

  // Force open for maintenance
  // await circuitBreaker.forceOpen();

  // Force close after maintenance
  // await circuitBreaker.forceClose();

  return { isAvailable, state, metrics };
}

// Example 9: Batch Operations with Circuit Breaker
export async function batchOperationsExample() {
  const operations = [
    { id: 'user_1', data: { name: 'Alice' } },
    { id: 'user_2', data: { name: 'Bob' } },
    { id: 'user_3', data: { name: 'Charlie' } },
  ];

  const results = await Promise.allSettled(
    operations.map(async (op) => {
      return CircuitBreakers.redis.execute(async () => {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });

        return await redis.set(`user:${op.id}`, JSON.stringify(op.data));
      }, `batch-set-user-${op.id}`);
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`Batch operation results: ${successful} successful, ${failed} failed`);

  return { successful, failed, results };
}

// Example 10: Circuit Breaker with Retry Logic
export async function circuitBreakerWithRetryExample() {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const result = await CircuitBreakers.redis.execute(async () => {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });

        // Simulate operation that might fail
        if (Math.random() < 0.3) { // 30% chance of failure
          throw new Error('Simulated failure');
        }

        return await redis.get('important-data');
      }, 'retry-operation');

      return result;
    } catch (error) {
      attempt++;
      console.log(`Attempt ${attempt} failed:`, error);

      if (attempt >= maxRetries) {
        throw new Error(`Operation failed after ${maxRetries} attempts`);
      }

      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Example 11: Circuit Breaker Event Handling
export class CircuitBreakerEventHandler {
  private circuitBreaker: PersistentCircuitBreaker;

  constructor(serviceName: string) {
    this.circuitBreaker = createCircuitBreaker(serviceName);
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // In a real implementation, you might want to set up actual event listeners
    // For now, we'll demonstrate with periodic health checks
    setInterval(async () => {
      const health = await this.circuitBreaker.getHealth();

      if (health.status === 'unhealthy') {
        console.warn(`Circuit breaker ${this.circuitBreaker} is unhealthy`);
        this.onUnhealthy(health);
      } else if (health.status === 'degraded') {
        console.warn(`Circuit breaker ${this.circuitBreaker} is degraded`);
        this.onDegraded(health);
      }
    }, 30000); // Check every 30 seconds
  }

  private onUnhealthy(health: any) {
    // Send alert to monitoring system
    console.error('Circuit breaker unhealthy:', health);

    // Could send to external monitoring service
    // await sendAlert('Circuit Breaker Unhealthy', health);
  }

  private onDegraded(health: any) {
    // Send warning to monitoring system
    console.warn('Circuit breaker degraded:', health);

    // Could send to external monitoring service
    // await sendWarning('Circuit Breaker Degraded', health);
  }

  async execute<T>(operation: () => Promise<T>, operationName?: string) {
    return this.circuitBreaker.execute(operation, operationName);
  }
}

// Example usage of event handler
export const paymentCircuitBreaker = new CircuitBreakerEventHandler('payment-service');

// Export all examples for testing
export const CircuitBreakerExamples = {
  basicCircuitBreakerExample,
  preConfiguredCircuitBreakerExample,
  databaseCircuitBreakerExample,
  externalApiCircuitBreakerExample,
  circuitBreakerProtectedRoute,
  circuitBreakerMonitoringExample,
  customCircuitBreakerExample,
  circuitBreakerStateManagementExample,
  batchOperationsExample,
  circuitBreakerWithRetryExample,
  paymentCircuitBreaker,
};