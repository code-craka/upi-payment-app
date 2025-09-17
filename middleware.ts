import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { createSecurityMiddleware } from "@/lib/middleware/security"
import { createCSRFMiddleware } from "@/lib/middleware/csrf"
import { createAuthMiddleware } from "@/lib/middleware/auth"
import { serverLogger } from "@/lib/utils/server-logger"
import type { UserRole } from "@/lib/types"

// Define route matchers
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pay(.*)",
  "/api/admin/bootstrap", // Allow bootstrap API for initial admin setup
  "/api/system-status", // Allow system status API for diagnostics
  "/api/debug/user", // Allow debug user API for troubleshooting
  "/api/debug/session-claims", // Allow session claims debug API
  "/api/debug/session", // Allow session debug API
  "/api/csrf-token" // Allow CSRF token endpoint
])

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"])

// Initialize middleware instances
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

const authMiddleware = createAuthMiddleware({
  redirectOnAuthFailure: true,
  redirectUrl: "/sign-in",
  publicRoutes: [
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/pay(.*)",
    "/api/admin/bootstrap",
    "/api/system-status",
    "/api/debug/user",
    "/api/debug/session-claims",
    "/api/debug/session",
    "/api/csrf-token"
  ],
  adminRoutes: ["/admin(.*)", "/api/admin(.*)"],
})

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

    // Apply authentication middleware
    const authResponse = await authMiddleware(req)
    if (authResponse.status !== 200) {
      return authResponse
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
