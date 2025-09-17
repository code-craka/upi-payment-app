# UPI Admin Dashboard - Comprehensive AI Agent Instructions

## Architecture Overview

Enterprise-grade UPI payment system with **hybrid authentication architecture** combining Clerk + Upstash Redis for instant role access and bulletproof reliability. Built with Next.js 14 App Router, production-grade security, and comprehensive monitoring.

### Core Technology Stack

- **Framework**: Next.js 14 with App Router (never use pages/ or _app.tsx)
- **Authentication**: Hybrid Clerk + Upstash Redis with 30-second TTL caching
- **Database**: MongoDB with Mongoose ODM and optimized indexes
- **Cache Layer**: Upstash Redis for role caching and circuit breaker state
- **Security**: CSRF protection, rate limiting, webhook verification, audit logging
- **UI**: TailwindCSS v4 with ShadCN components and custom styling
- **TypeScript**: 100% TypeScript coverage with Zod validation
- **Monitoring**: Comprehensive observability with health checks and alerting

---

## 🔐 Hybrid Authentication & Role Management

### Authentication Architecture Pattern

```typescript
import { getHybridAuthContext, getCachedUserRole } from "@/lib/auth/hybrid-auth";
import { RedisCircuitBreaker } from "@/lib/circuit-breaker";
import { currentUser } from "@clerk/nextjs/server";

// Hybrid authentication: Redis-first, Clerk fallback
const authContext = await getHybridAuthContext(userId);
if (authContext.redis.cached && authContext.redis.ttl > 0) {
  return authContext.redis.role; // Sub-30ms response
}
// Fallback to Clerk if Redis unavailable
if (authContext.clerk.authenticated) {
  await syncRoleToRedis(userId, authContext.clerk.role);
  return authContext.clerk.role;
}
```

### Core Authentication Rules

- **✅ Hybrid System**: Always implement Redis-first with Clerk fallback
- **✅ 30-Second TTL**: Role cache expires after 30 seconds for security
- **✅ Circuit Breaker**: Use circuit breaker for Redis operations
- **✅ Dual Write**: Update both Clerk (source) and Redis (cache) for role changes
- **✅ Atomic Operations**: Use Lua scripts for race condition prevention
- **✅ Auto-Sync**: Background sync between Clerk and Redis
- **❌ Never**: Rely on single authentication source in production

### Role Management Implementation

```typescript
// Dual-write role updates with atomic operations
async function updateUserRole(userId: string, newRole: string) {
  const luaScript = `
    local version = redis.call('incr', KEYS[2])
    redis.call('setex', KEYS[1], 30, ARGV[1])
    return version
  `;
  
  try {
    // 1. Update Clerk (source of truth)
    await clerkClient.users.updateUser(userId, {
      publicMetadata: { role: newRole }
    });
    
    // 2. Update Redis cache atomically
    await redis.eval(luaScript, 2, `role:${userId}`, `role_version:${userId}`, newRole);
    
    // 3. Audit logging
    await auditLog('role_updated', { userId, newRole, timestamp: Date.now() });
    
  } catch (error) {
    // Implement rollback strategy
    await handleRoleUpdateFailure(userId, newRole, error);
  }
}
```

---

## 🛡️ Production Security & Circuit Breaker

### Circuit Breaker Implementation (Required)

```typescript
// lib/circuit-breaker.ts
export class ServerlessCircuitBreaker {
  private async getState(): Promise<CircuitState> {
    const state = await redis.get('circuit_breaker:redis');
    return state ? JSON.parse(state) : { 
      failures: 0, 
      state: 'CLOSED', 
      lastFailure: 0 
    };
  }
  
  private async updateState(newState: CircuitState): Promise<void> {
    await redis.setex('circuit_breaker:redis', 300, JSON.stringify(newState));
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const state = await this.getState();
    
    if (state.state === 'OPEN') {
      if (Date.now() - state.lastFailure > 60000) { // 1 minute timeout
        state.state = 'HALF_OPEN';
        await this.updateState(state);
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      if (state.state === 'HALF_OPEN') {
        state.state = 'CLOSED';
        state.failures = 0;
        await this.updateState(state);
      }
      return result;
    } catch (error) {
      state.failures++;
      state.lastFailure = Date.now();
      if (state.failures >= 5) {
        state.state = 'OPEN';
      }
      await this.updateState(state);
      throw error;
    }
  }
}
```

### Webhook Security Implementation

```typescript
import { Webhook } from 'svix';

export async function verifyClerkWebhook(request: Request) {
  const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  const payload = await request.text();
  const headers = Object.fromEntries(request.headers.entries());
  
  try {
    const event = webhook.verify(payload, headers);
    return event;
  } catch (error) {
    // Log to dead letter queue
    await redis.lpush('webhook:dlq', JSON.stringify({
      payload,
      error: error.message,
      timestamp: Date.now(),
      headers
    }));
    throw new Error('Invalid webhook signature');
  }
}
```

### Dead Letter Queue Pattern

```typescript
// Handle failed webhook processing
export async function handleWebhookFailure(
  event: WebhookEvent, 
  error: Error
) {
  await redis.lpush('webhook:dlq', JSON.stringify({
    event,
    error: error.message,
    timestamp: Date.now(),
    retryCount: 0
  }));
  
  // Alert if DLQ size exceeds threshold
  const dlqSize = await redis.llen('webhook:dlq');
  if (dlqSize > 10) {
    await sendAlert('Webhook DLQ overflow', { size: dlqSize });
  }
}
```

---

## 📊 Monitoring & Health Checks

### Comprehensive Health Check Implementation

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedisWithLatency(),
    checkClerkConnectivity(),
    validateCacheHitRatio()
  ]);
  
  const results = checks.map((check, index) => ({
    service: ['database', 'redis', 'clerk', 'cache'][index],
    status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    details: check.status === 'fulfilled' ? check.value : check.reason
  }));
  
  const overallHealth = results.every(r => r.status === 'healthy');
  
  return NextResponse.json({
    status: overallHealth ? 'healthy' : 'degraded',
    services: results,
    timestamp: new Date().toISOString()
  }, { 
    status: overallHealth ? 200 : 503 
  });
}

async function checkRedisWithLatency() {
  const start = performance.now();
  await redis.ping();
  const latency = performance.now() - start;
  
  return {
    connected: true,
    latency: `${latency.toFixed(2)}ms`,
    status: latency < 100 ? 'optimal' : 'slow'
  };
}
```

### Cache Hit Ratio Monitoring

```typescript
// Track cache performance metrics
export async function trackCacheHit(key: string, hit: boolean) {
  const date = new Date().toISOString().split('T')[0];
  await redis.incr(`cache:${hit ? 'hits' : 'misses'}:${date}`);
}

export async function getCacheStats() {
  const date = new Date().toISOString().split('T')[0];
  const hits = await redis.get(`cache:hits:${date}`) || '0';
  const misses = await redis.get(`cache:misses:${date}`) || '0';
  
  const hitRatio = parseInt(hits) / (parseInt(hits) + parseInt(misses));
  
  // Alert if cache hit ratio drops below 60%
  if (hitRatio < 0.6) {
    await sendAlert('Low cache hit ratio', { ratio: hitRatio });
  }
  
  return { hits: parseInt(hits), misses: parseInt(misses), ratio: hitRatio };
}
```

---

## 🗄️ Database & Models with Redis Integration

### Enhanced Database Operations

```typescript
import { connectDB } from "@/lib/db/connection";
import { getCachedUserRole } from "@/lib/auth/hybrid-auth";

// Database operations with caching layer
export class UserService {
  static async getUserWithRole(userId: string) {
    // Try cache first
    const cachedRole = await getCachedUserRole(userId);
    if (cachedRole) {
      return { userId, role: cachedRole, cached: true };
    }
    
    // Fallback to database
    await connectDB();
    const user = await UserModel.findById(userId);
    
    // Cache the result
    if (user?.role) {
      await cacheUserRole(userId, user.role, 30);
    }
    
    return { ...user, cached: false };
  }
}
```

### Audit Logging with Context

```typescript
// Enhanced audit logging with Redis metrics
await AuditLogModel.create({
  action: 'role_updated',
  entityType: 'User',
  entityId: userId,
  userId: adminId,
  ipAddress: request.headers.get('x-forwarded-for'),
  metadata: {
    previousRole,
    newRole,
    cacheHit: cachedRole !== null,
    latency: `${performanceMetrics.totalLatency}ms`,
    source: cachedRole ? 'redis' : 'clerk'
  },
  timestamp: new Date()
});
```

---

## 🚀 API Route Patterns with Resilience

### Production API Route Template

```typescript
export async function POST(request: NextRequest) {
  const circuitBreaker = new ServerlessCircuitBreaker();
  
  try {
    // 1. Hybrid authentication with circuit breaker
    const authContext = await circuitBreaker.execute(() => 
      getHybridAuthContext(request)
    );
    
    if (!authContext.authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // 2. Role validation from cache or Clerk
    const userRole = await getUserRoleWithFallback(authContext.userId);
    if (!hasPermission(userRole, 'required_permission')) {
      await auditLog('permission_denied', { 
        userId: authContext.userId, 
        permission: 'required_permission',
        source: authContext.source 
      });
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // 3. Request validation with Zod
    const schema = z.object({ /* schema definition */ });
    const validatedData = schema.parse(await request.json());

    // 4. Database operations with monitoring
    await connectDB();
    const start = performance.now();
    const result = await Model.performOperation(validatedData);
    const dbLatency = performance.now() - start;

    // 5. Update cache if needed
    if (result.affectsUserRole) {
      await syncRoleToRedis(authContext.userId, result.newRole);
    }

    // 6. Comprehensive audit logging
    await AuditLogModel.create({
      action: 'operation_performed',
      entityType: 'Entity',
      entityId: result.id,
      userId: authContext.userId,
      ipAddress: request.headers.get('x-forwarded-for'),
      metadata: {
        dbLatency: `${dbLatency.toFixed(2)}ms`,
        authSource: authContext.source,
        cacheHit: authContext.cached
      }
    });

    // 7. Performance monitoring
    if (dbLatency > 1000) {
      await sendAlert('Slow database operation', { 
        operation: 'performOperation', 
        latency: dbLatency 
      });
    }

    return NextResponse.json({ 
      success: true, 
      data: result,
      performance: {
        authLatency: authContext.latency,
        dbLatency: `${dbLatency.toFixed(2)}ms`
      }
    }, { status: 200 });

  } catch (error) {
    // Enhanced error handling with context
    console.error('Operation failed:', {
      error: error.message,
      stack: error.stack,
      userId: authContext?.userId,
      timestamp: new Date().toISOString()
    });

    // Circuit breaker may have triggered
    if (error.message.includes('Circuit breaker is OPEN')) {
      return NextResponse.json({
        error: "Service temporarily unavailable",
        retryAfter: 60
      }, { status: 503 });
    }

    return NextResponse.json({
      error: "Operation failed",
      details: error instanceof Error ? error.message : "Unknown error",
      requestId: crypto.randomUUID()
    }, { status: 500 });
  }
}
```

---

## 🎨 Component Development with Role Caching

### Role-Aware Components

```typescript
// components/role-aware-dashboard.tsx
import { useHybridRole } from '@/hooks/useHybridRole';

export function RoleAwareDashboard() {
  const { 
    role, 
    isLoading, 
    isAdmin, 
    cacheHit, 
    refresh,
    latency 
  } = useHybridRole({
    refreshInterval: 30000, // 30 seconds
    onRoleChange: (oldRole, newRole) => {
      console.log(`Role updated: ${oldRole} → ${newRole}`);
      // Trigger UI updates
    }
  });

  if (isLoading) return <LoadingSpinner />;
  
  return (
    <div>
      <AdminPanel visible={isAdmin} />
      <div className="text-xs text-gray-500">
        Auth: {cacheHit ? 'cached' : 'live'} ({latency}ms)
      </div>
    </div>
  );
}
```

### Hydration-Safe Authentication

```typescript
// components/hybrid-auth-provider.tsx
"use client"
import { useEffect, useState } from 'react';

export function HybridAuthProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div suppressHydrationWarning>{children}</div>;
  }

  return (
    <div>
      {children}
      <RoleRefreshHandler />
    </div>
  );
}
```

---

## 💼 Payment Flow with Enhanced Security

### Secure Payment Processing

```typescript
// Enhanced payment flow with audit trails
export async function createPaymentOrder(orderData: CreateOrderRequest) {
  const orderId = crypto.randomUUID();
  
  try {
    // 1. Create order with timeout
    const order = await OrderModel.create({
      ...orderData,
      orderId,
      status: 'pending',
      expiresAt: new Date(Date.now() + 540000), // 9 minutes
      createdAt: new Date()
    });

    // 2. Generate secure QR code
    const qrData = generateSecureUPIQR({
      payeeAddress: process.env.UPI_ID,
      payeeName: process.env.MERCHANT_NAME,
      amount: orderData.amount,
      transactionRef: orderId,
      currency: 'INR'
    });

    // 3. Cache order data for quick access
    await redis.setex(`order:${orderId}`, 600, JSON.stringify(order));

    // 4. Comprehensive audit logging
    await AuditLogModel.create({
      action: 'payment_order_created',
      entityType: 'Order',
      entityId: orderId,
      userId: orderData.userId,
      metadata: {
        amount: orderData.amount,
        customerEmail: orderData.customerInfo.email,
        expiresAt: order.expiresAt
      }
    });

    return {
      orderId,
      paymentUrl: `/pay/${orderId}`,
      qrCode: qrData,
      expiresAt: order.expiresAt
    };

  } catch (error) {
    await auditLog('payment_order_failed', { 
      error: error.message, 
      orderData 
    });
    throw error;
  }
}
```

---

## 📁 Enhanced Project Structure

```bash
lib/
├── types.ts                    # TypeScript interfaces & Zod schemas
├── utils.ts                    # Utility functions
├── auth/
│   ├── hybrid-auth.ts          # Redis + Clerk hybrid authentication
│   ├── safe-auth.ts           # Safe auth wrappers
│   └── permissions.ts         # Role-based permissions
├── cache/
│   ├── redis-client.ts        # Upstash Redis client
│   └── circuit-breaker.ts     # Circuit breaker implementation
├── db/
│   ├── connection.ts          # Database connection
│   └── models/               # Mongoose models with caching
├── monitoring/
│   ├── health-checks.ts       # Comprehensive health monitoring
│   ├── metrics.ts            # Performance metrics collection
│   └── alerts.ts             # Alert system integration
└── security/
    ├── webhook-verification.ts # Webhook signature verification
    ├── rate-limiting.ts       # Advanced rate limiting
    └── audit-logging.ts       # Enhanced audit trails

hooks/
├── useHybridRole.ts           # Real-time role management hook
├── useHealthCheck.ts          # System health monitoring hook
└── usePerformanceMetrics.ts   # Performance tracking hook
```

---

## 🚨 Production-Grade Requirements

### Mandatory Implementation Checklist

- **✅ Circuit Breaker**: Redis operations must use circuit breaker
- **✅ Atomic Operations**: Use Lua scripts for race condition prevention
- **✅ Dead Letter Queue**: Failed webhooks go to Redis DLQ
- **✅ Health Monitoring**: Comprehensive health checks with alerting
- **✅ Cache Metrics**: Track hit ratios and performance
- **✅ Graceful Degradation**: System works when Redis is unavailable
- **✅ Webhook Security**: Verify signatures with svix library
- **✅ Performance Budget**: Alert on operations exceeding thresholds

### Error Recovery Patterns

```typescript
// Rollback strategy for dual-write failures
async function handleDualWriteFailure(
  operation: string, 
  clerkSuccess: boolean, 
  redisSuccess: boolean,
  context: any
) {
  if (clerkSuccess && !redisSuccess) {
    // Clerk succeeded, Redis failed - log for manual sync
    await auditLog('redis_sync_failed', { 
      operation, 
      context,
      requiresManualSync: true 
    });
    // Don't rollback Clerk - it's source of truth
  } else if (!clerkSuccess && redisSuccess) {
    // Redis succeeded, Clerk failed - rollback Redis
    await redis.del(`role:${context.userId}`);
    await auditLog('clerk_update_failed_redis_rolled_back', context);
  }
}
```

---

## ⚡ Development & Testing Commands

```bash
pnpm dev              # Development with Redis connection
pnpm build            # Production build with cache warming
pnpm test:integration # Integration tests with Redis
pnpm test:circuit     # Circuit breaker failure tests
pnpm monitor          # Health check and metrics dashboard
```

---

This enhanced instruction set ensures AI agents generate production-ready code with proper resilience, monitoring, and security patterns for the hybrid authentication architecture.