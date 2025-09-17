import { NextRequest } from 'next/server'
import { redis } from '@/lib/redis'

interface RateLimitConfig {
  max: number
  windowMs: number
  keyGenerator?: (req: NextRequest) => string
  message?: string
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: Date
  message?: string
}

// Default key generator using IP address
const defaultKeyGenerator = (request: NextRequest): string => {
  return (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

// Simple rate limiting with Redis
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { max, windowMs, keyGenerator = defaultKeyGenerator, message } = config
  
  try {
    const identifier = keyGenerator(request)
    const key = `rate_limit:${identifier}`
    const now = Date.now()
    const window = Math.floor(now / windowMs)
    const windowKey = `${key}:${window}`
    
    // Increment counter for current window
    const count = await redis.incr(windowKey)
    
    // Set expiration on first request in window
    if (count === 1) {
      await redis.expire(windowKey, Math.ceil(windowMs / 1000))
    }
    
    const remaining = Math.max(0, max - count)
    const resetTime = new Date((window + 1) * windowMs)
    
    if (count > max) {
      return {
        success: false,
        limit: max,
        remaining: 0,
        resetTime,
        message: message || 'Rate limit exceeded'
      }
    }
    
    return {
      success: true,
      limit: max,
      remaining,
      resetTime
    }
  } catch (error) {
    console.error('Rate limiting error:', error)
    
    // Fail open - allow request if Redis is down
    return {
      success: true,
      limit: max,
      remaining: max - 1,
      resetTime: new Date(Date.now() + windowMs),
      message: 'Rate limiting unavailable'
    }
  }
}

// User-specific rate limiting with different tiers
export async function userRateLimit(
  request: NextRequest,
  userId: string,
  action: string,
  limits: {
    guest?: { max: number; windowMs: number }
    user?: { max: number; windowMs: number }
    premium?: { max: number; windowMs: number }
  }
): Promise<RateLimitResult> {
  // Determine user tier (you can implement your own logic)
  const userTier = userId ? 'user' : 'guest' // Simplified logic
  
  const config = limits[userTier] || limits.guest
  
  if (!config) {
    return {
      success: true,
      limit: 100,
      remaining: 100,
      resetTime: new Date(Date.now() + 60000)
    }
  }
  
  return rateLimit(request, {
    ...config,
    keyGenerator: () => `${action}:${userId || defaultKeyGenerator(request)}`,
    message: `Rate limit exceeded for ${action}`
  })
}

// Rate limit middleware factory
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (request: NextRequest) => {
    const result = await rateLimit(request, config)
    
    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: result.message || 'Rate limit exceeded',
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.resetTime.toISOString()
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toISOString(),
            'Retry-After': Math.ceil((result.resetTime.getTime() - Date.now()) / 1000).toString()
          }
        }
      )
    }
    
    return null // Continue to next middleware
  }
}

// Common rate limit configurations
export const RATE_LIMIT_CONFIGS = {
  // API endpoints
  api: {
    max: 100,
    windowMs: 60 * 1000, // 1 minute
    message: 'API rate limit exceeded'
  },
  
  // Authentication endpoints
  auth: {
    max: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many authentication attempts'
  },
  
  // Payment endpoints
  payment: {
    max: 10,
    windowMs: 60 * 1000, // 1 minute
    message: 'Payment rate limit exceeded'
  },
  
  // UTR submission
  utr: {
    max: 5,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many UTR submissions'
  },
  
  // Order creation
  orders: {
    max: 20,
    windowMs: 60 * 1000, // 1 minute
    message: 'Order creation rate limit exceeded'
  },
  
  // Generic strict limit
  strict: {
    max: 3,
    windowMs: 60 * 1000, // 1 minute
    message: 'Rate limit exceeded'
  }
} as const