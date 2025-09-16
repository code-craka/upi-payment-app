import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { createSecurityMiddleware } from "@/lib/middleware/security"
import { createCSRFMiddleware } from "@/lib/middleware/csrf"
import { serverLogger } from "@/lib/utils/server-logger"
import type { UserRole } from "@/lib/types"

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

    // Get authentication details using the auth() from middleware context
    const authObj = await auth()
    const { userId, sessionClaims } = authObj
    
    // Redirect to sign-in if not authenticated
    if (!userId) {
      serverLogger.middleware(`Unauthenticated access attempt to: ${req.nextUrl.pathname}`)
      return NextResponse.redirect(new URL("/sign-in", req.url))
    }

    // Admin route protection with hybrid role management
    if (isAdminRoute(req)) {
      // Use simpler approach - get role directly from Clerk session claims first
      const publicMetadata = sessionClaims?.publicMetadata as { role?: UserRole } | undefined
      const role = publicMetadata?.role
      
      if (!role) {
        serverLogger.middleware("No role found for admin route access", {
          pathname: req.nextUrl.pathname,
          userId,
          source: 'clerk',
          confidence: 0
        })
        
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return NextResponse.json(
            { 
              error: "Access Denied",
              message: "No role assigned. Please contact administrator.",
              needsBootstrap: true
            }, 
            { status: 403 }
          )
        }
        
        return NextResponse.redirect(new URL("/unauthorized", req.url))
      }
      
      // Check if user has admin role
      if (role !== "admin") {
        serverLogger.middleware("Access denied for admin route - insufficient role", {
          pathname: req.nextUrl.pathname,
          userId,
          currentRole: role,
          requiredRole: "admin"
        })
        
        if (req.nextUrl.pathname.startsWith('/api/')) {
          return NextResponse.json(
            { 
              error: "Access Denied",
              message: "Admin privileges required to access this resource",
              requiredRole: "admin",
              currentRole: role
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
        role
      })
      
      return NextResponse.next()
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
