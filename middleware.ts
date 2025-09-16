import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { createSecurityMiddleware } from "@/lib/middleware/security"
import { createCSRFMiddleware } from "@/lib/middleware/csrf"
import { serverLogger } from "@/lib/utils/server-logger"
import { currentUser } from "@clerk/nextjs/server"
import { getCachedUserRole, syncUserRole, cacheUserRole } from "@/lib/redis"
import type { UserRole, HybridAuthContext } from "@/lib/types"

// Define route matchers
const isPublicRoute = createRouteMatcher([
  "/", 
  "/sign-in(.*)", 
  "/sign-up(.*)", 
  "/pay(.*)",
  "/api/admin-bootstrap", // Allow bootstrap API for initial admin setup
  "/api/system-status", // Allow system status API for diagnostics
  "/api/debug/user", // Allow debug user API for troubleshooting
  "/api/debug/session-claims", // Allow session claims debug API
  "/api/debug/session", // Allow session debug API
  "/api/csrf-token" // Allow CSRF token endpoint
])

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"])

// Security middleware setup
const securityMiddleware = createSecurityMiddleware({
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // per IP
  },
  csrf: {
    enabled: true,
    tokenExpiry: 60 * 60 * 1000, // 1 hour
  },
})

const csrfMiddleware = createCSRFMiddleware()

/**
 * Get hybrid auth context with Redis-first, Clerk fallback
 */
async function getHybridAuthContext(userId: string): Promise<HybridAuthContext> {
  const start = Date.now()
  
  try {
    // First, try to get role from Redis cache
    const cachedRole = await getCachedUserRole(userId)
    
    if (cachedRole && cachedRole.role && cachedRole.lastSync > Date.now() - 30000) {
      // Fresh cache hit (less than 30 seconds old)
      return {
        userId,
        email: "", // Will be populated later if needed
        role: cachedRole.role as UserRole,
        source: 'redis',
        confidence: 0.9,
        requiresSync: false,
        lastSync: cachedRole.lastSync,
      }
    }
    
    // Cache miss or stale - fallback to Clerk
    const user = await currentUser()
    
    if (!user) {
      return {
        userId,
        email: "",
        role: null,
        source: 'fallback',
        confidence: 0,
        requiresSync: false,
      }
    }
    
    const clerkRole = user.publicMetadata?.role as UserRole
    
    // Sync role to Redis in background (non-blocking)
    if (clerkRole) {
      syncUserRole(userId, clerkRole).catch(error => {
        serverLogger.error("Background role sync failed", error)
      })
    }
    
    return {
      userId: user.id,
      email: user.primaryEmailAddress?.emailAddress || "",
      role: clerkRole || null,
      source: 'clerk',
      confidence: clerkRole ? 0.8 : 0.1,
      requiresSync: !cachedRole || cachedRole.role !== clerkRole,
    }
    
  } catch (error) {
    serverLogger.error("Error getting hybrid auth context", error)
    
    return {
      userId,
      email: "",
      role: null,
      source: 'fallback',
      confidence: 0,
      requiresSync: true,
    }
  }
}

export default clerkMiddleware(async (auth, req) => {
  try {
    // Apply security middleware first
    const securityResponse = await securityMiddleware(req)
    if (securityResponse.status !== 200) {
      return securityResponse
    }

    // Apply CSRF protection for non-GET requests
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const csrfResponse = await csrfMiddleware(req)
      if (csrfResponse.status !== 200) {
        return csrfResponse
      }
    }

    // Allow public routes to bypass authentication
    if (isPublicRoute(req)) {
      return NextResponse.next()
    }

    // Get authentication details
    const { userId, sessionClaims } = await auth()
    
    // Redirect to sign-in if not authenticated
    if (!userId) {
      serverLogger.middleware(`Unauthenticated access attempt to: ${req.nextUrl.pathname}`)
      return NextResponse.redirect(new URL("/sign-in", req.url))
    }

    // Admin route protection with hybrid role management
    if (isAdminRoute(req)) {
      const authContext = await getHybridAuthContext(userId)
      
      // No role found anywhere
      if (!authContext.role) {
        serverLogger.middleware("No role found for admin route access", {
          pathname: req.nextUrl.pathname,
          userId,
          source: authContext.source,
          confidence: authContext.confidence
        })
        
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return NextResponse.json(
            { 
              error: "Access Denied",
              message: "No role assigned. Please contact administrator.",
              needsBootstrap: true,
              source: authContext.source
            }, 
            { status: 403 }
          )
        }
        
        return NextResponse.redirect(new URL("/unauthorized", req.url))
      }
      
      // Check if user has admin role
      if (authContext.role !== "admin") {
        serverLogger.middleware("Access denied for admin route - insufficient role", {
          pathname: req.nextUrl.pathname,
          userId,
          currentRole: authContext.role,
          requiredRole: "admin",
          source: authContext.source,
          confidence: authContext.confidence
        })
        
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return NextResponse.json(
            { 
              error: "Access Denied",
              message: "Admin privileges required to access this resource",
              requiredRole: "admin",
              currentRole: authContext.role,
              source: authContext.source
            }, 
            { status: 403 }
          )
        }
        
        return NextResponse.redirect(new URL("/unauthorized", req.url))
      }

      // Log successful admin access with hybrid context
      serverLogger.middleware("Admin access granted", {
        pathname: req.nextUrl.pathname,
        userId,
        role: authContext.role,
        source: authContext.source,
        confidence: authContext.confidence,
        requiresSync: authContext.requiresSync,
        lastSync: authContext.lastSync
      })
      
      // Add hybrid auth context to request headers for downstream consumption
      const response = NextResponse.next()
      response.headers.set('x-auth-source', authContext.source)
      response.headers.set('x-auth-confidence', authContext.confidence.toString())
      response.headers.set('x-auth-requires-sync', authContext.requiresSync.toString())
      
      return response
    }

    return NextResponse.next()

  } catch (error) {
    serverLogger.error("Error processing request in middleware", error)
    return NextResponse.json(
      { 
        error: "Internal Server Error",
        message: "An error occurred while processing your request"
      }, 
      { status: 500 }
    )
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
