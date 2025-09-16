import { type NextRequest, NextResponse } from "next/server"

// Rate limiting store (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// CSRF token store (in production, use secure session storage)
const csrfTokenStore = new Map<string, { token: string; expires: number }>()

export interface SecurityConfig {
  rateLimit: {
    windowMs: number
    maxRequests: number
  }
  csrf: {
    enabled: boolean
    tokenExpiry: number
  }
  headers: {
    contentSecurityPolicy: string
    strictTransportSecurity: string
    xFrameOptions: string
    xContentTypeOptions: string
    referrerPolicy: string
  }
}

const defaultSecurityConfig: SecurityConfig = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // limit each IP to 100 requests per windowMs
  },
  csrf: {
    enabled: true,
    tokenExpiry: 60 * 60 * 1000, // 1 hour
  },
  headers: {
    contentSecurityPolicy:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;",
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    referrerPolicy: "strict-origin-when-cross-origin",
  },
}

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")

  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }

  if (realIP) {
    return realIP
  }

  return request.ip || "unknown"
}

export function rateLimit(
  request: NextRequest,
  config: SecurityConfig["rateLimit"] = defaultSecurityConfig.rateLimit,
): { allowed: boolean; remaining: number; resetTime: number } {
  const clientIP = getClientIP(request)
  const now = Date.now()
  const key = `rate_limit:${clientIP}`

  const existing = rateLimitStore.get(key)

  if (!existing || now > existing.resetTime) {
    // Reset or create new entry
    const resetTime = now + config.windowMs
    rateLimitStore.set(key, { count: 1, resetTime })
    return { allowed: true, remaining: config.maxRequests - 1, resetTime }
  }

  if (existing.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: existing.resetTime }
  }

  // Increment count
  existing.count++
  rateLimitStore.set(key, existing)

  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetTime: existing.resetTime,
  }
}

export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomUUID()
  const expires = Date.now() + defaultSecurityConfig.csrf.tokenExpiry

  csrfTokenStore.set(sessionId, { token, expires })

  // Clean up expired tokens
  for (const [key, value] of csrfTokenStore.entries()) {
    if (Date.now() > value.expires) {
      csrfTokenStore.delete(key)
    }
  }

  return token
}

export function validateCSRFToken(sessionId: string, token: string): boolean {
  const stored = csrfTokenStore.get(sessionId)

  if (!stored || Date.now() > stored.expires) {
    csrfTokenStore.delete(sessionId)
    return false
  }

  return stored.token === token
}

export function addSecurityHeaders(
  response: NextResponse,
  config: SecurityConfig["headers"] = defaultSecurityConfig.headers,
): NextResponse {
  // Security headers
  response.headers.set("Content-Security-Policy", config.contentSecurityPolicy)
  response.headers.set("Strict-Transport-Security", config.strictTransportSecurity)
  response.headers.set("X-Frame-Options", config.xFrameOptions)
  response.headers.set("X-Content-Type-Options", config.xContentTypeOptions)
  response.headers.set("Referrer-Policy", config.referrerPolicy)
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

  return response
}

export function sanitizeInput(input: string): string {
  // Basic XSS prevention - in production, use a library like DOMPurify
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim()
}

export function createSecurityMiddleware(config: Partial<SecurityConfig> = {}) {
  const securityConfig = { ...defaultSecurityConfig, ...config }

  return async function securityMiddleware(request: NextRequest) {
    const response = NextResponse.next()

    // Add security headers
    addSecurityHeaders(response, securityConfig.headers)

    // Rate limiting for API routes
    if (request.nextUrl.pathname.startsWith("/api/")) {
      const rateLimitResult = rateLimit(request, securityConfig.rateLimit)

      // Add rate limit headers
      response.headers.set("X-RateLimit-Limit", securityConfig.rateLimit.maxRequests.toString())
      response.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString())
      response.headers.set("X-RateLimit-Reset", new Date(rateLimitResult.resetTime).toISOString())

      if (!rateLimitResult.allowed) {
        return new NextResponse(
          JSON.stringify({
            error: "Too Many Requests",
            message: "Rate limit exceeded. Please try again later.",
            retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
              ...Object.fromEntries(response.headers.entries()),
            },
          },
        )
      }
    }

    return response
  }
}
