import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { createSecurityMiddleware } from "@/lib/middleware/security"
import { createCSRFMiddleware } from "@/lib/middleware/csrf"
import { serverLogger } from "@/lib/utils/server-logger"
import { currentUser } from "@clerk/nextjs/server"
import { getSessionWithFallback, hasRoleWithFallback } from "@/lib/auth/fallback-auth"

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

    // Admin route protection
    if (isAdminRoute(req)) {
      // Get user session with Redis-first, Clerk fallback, TTL auto-refresh
      const session = await getSessionWithFallback(userId, true)
      
      if (!session.hasSession) {
        // No session found in Redis - check if user exists in Clerk
        const user = await currentUser()
        if (!user) {
          serverLogger.middleware("No user found for admin route access", {
            pathname: req.nextUrl.pathname,
            userId
          })
          
          if (req.nextUrl.pathname.startsWith('/api/')) {
            return NextResponse.json(
              { 
                error: "Authentication Required",
                message: "User session not found"
              }, 
              { status: 401 }
            )
          }
          
          return NextResponse.redirect(new URL("/sign-in", req.url))
        }

        // User exists but no session - this means they need to be bootstrapped
        const clerkRole = user.publicMetadata?.role as string
        
        serverLogger.middleware("No session found, user needs bootstrap", {
          pathname: req.nextUrl.pathname,
          userId: user.id,
          clerkRole: clerkRole || 'undefined',
          sessionSource: session.source,
          redisAvailable: session.redisAvailable
        })
        
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return NextResponse.json(
            { 
              error: "Session Not Found",
              message: "User session not initialized. Please contact administrator.",
              needsBootstrap: true,
              sessionSource: session.source,
              redisAvailable: session.redisAvailable
            }, 
            { status: 403 }
          )
        }
        
        return NextResponse.redirect(new URL("/unauthorized", req.url))
      }

      // Check if user has admin role from Redis session
      if (session.role !== "admin") {
        serverLogger.middleware("Access denied for admin route - insufficient role", {
          pathname: req.nextUrl.pathname,
          userId,
          currentRole: session.role,
          requiredRole: "admin",
          sessionUpdatedAt: session.updatedAt
        })
        
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return NextResponse.json(
            { 
              error: "Access Denied",
              message: "Admin privileges required to access this resource",
              requiredRole: "admin",
              currentRole: session.role
            }, 
            { status: 403 }
          )
        }
        
        return NextResponse.redirect(new URL("/unauthorized", req.url))
      }

      // Log successful admin access
      serverLogger.middleware("Admin access granted", {
        pathname: req.nextUrl.pathname,
        userId,
        role: session.role,
        sessionUpdatedAt: session.updatedAt,
        sessionSource: session.source,
        redisAvailable: session.redisAvailable
      })
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
