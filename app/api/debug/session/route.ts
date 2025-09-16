import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { getSessionResponse, redisHealthCheck } from "@/lib/session/redis"
import { serverLogger } from "@/lib/utils/server-logger"
import type { SessionResponse } from "@/lib/types"

/**
 * Debug endpoint to examine current user Redis session
 * This helps diagnose role validation issues and session state
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Check Redis health first
    const redisHealthy = await redisHealthCheck()
    
    if (!redisHealthy) {
      serverLogger.error("Redis health check failed in debug session API")
      return NextResponse.json({
        error: "Redis Connection Error",
        message: "Redis server is not accessible",
        redisHealthy: false,
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    // 2. Authentication check
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({
        error: "Authentication Required",
        message: "User must be signed in to view session information",
        redisHealthy,
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // 3. Get session response from Redis
    const sessionResponse: SessionResponse = await getSessionResponse(user.id)

    // 4. Build comprehensive debug information
    const debugInfo = {
      success: true,
      timestamp: new Date().toISOString(),
      redisHealthy,
      userInfo: {
        id: user.id,
        email: user.emailAddresses?.[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
      },
      clerkMetadata: {
        publicMetadata: user.publicMetadata,
        privateMetadata: user.privateMetadata,
        unsafeMetadata: user.unsafeMetadata,
      },
      redisSession: sessionResponse,
      comparison: {
        clerkRole: (user.publicMetadata as { role?: string })?.role || null,
        redisRole: sessionResponse.role,
        rolesMatch: ((user.publicMetadata as { role?: string })?.role || null) === sessionResponse.role,
        hasRedisSession: sessionResponse.hasSession,
      },
      diagnostics: {
        sessionAge: sessionResponse.updatedAt 
          ? Math.floor((new Date().getTime() - sessionResponse.updatedAt.getTime()) / 1000)
          : null,
        sessionAgeHuman: sessionResponse.updatedAt
          ? getHumanReadableTimeDiff(sessionResponse.updatedAt)
          : 'No session',
      },
      recommendations: generateRecommendations(user, sessionResponse),
    }

    // 5. Log the debug access
    serverLogger.debug("Session debug API accessed", {
      userId: user.id,
      email: user.emailAddresses?.[0]?.emailAddress,
      hasRedisSession: sessionResponse.hasSession,
      clerkRole: (user.publicMetadata as { role?: string })?.role || null,
      redisRole: sessionResponse.role,
      rolesMatch: debugInfo.comparison.rolesMatch
    })

    return NextResponse.json(debugInfo, { status: 200 })

  } catch (error) {
    serverLogger.error("Debug session API internal error", error)
    return NextResponse.json({
      error: "Internal Server Error",
      message: "An unexpected error occurred while retrieving session information",
      timestamp: new Date().toISOString(),
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

/**
 * Update session endpoint for testing immediate role changes
 */
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({
        error: "Authentication Required"
      }, { status: 401 })
    }

    // This is for debugging only - in production you might want to restrict this
    const body = await request.json()
    const { action } = body

    if (action === "refresh") {
      // Just refresh the session info without changing it
      const sessionResponse = await getSessionResponse(user.id)
      
      serverLogger.info("Session refresh requested", {
        userId: user.id,
        hasSession: sessionResponse.hasSession
      })

      return NextResponse.json({
        success: true,
        message: "Session information refreshed",
        session: sessionResponse,
        timestamp: new Date().toISOString()
      })
    }

    return NextResponse.json({
      error: "Invalid Action",
      message: "Only 'refresh' action is supported",
      availableActions: ["refresh"]
    }, { status: 400 })

  } catch (error) {
    serverLogger.error("Debug session POST API error", error)
    return NextResponse.json({
      error: "Internal Server Error",
      message: "An unexpected error occurred"
    }, { status: 500 })
  }
}

/**
 * Generate human-readable time difference
 */
function getHumanReadableTimeDiff(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
  } else {
    return `${diffSeconds} second${diffSeconds > 1 ? 's' : ''} ago`
  }
}

/**
 * Generate recommendations based on session state
 */
function generateRecommendations(user: any, sessionResponse: SessionResponse): string[] {
  const recommendations: string[] = []
  const clerkRole = (user.publicMetadata as { role?: string })?.role || null

  if (!sessionResponse.hasSession) {
    recommendations.push("No Redis session found. Use /api/admin-bootstrap to initialize user role.")
    
    if (clerkRole) {
      recommendations.push(`User has '${clerkRole}' role in Clerk but no Redis session. Bootstrap is required.`)
    } else {
      recommendations.push("User has no role in Clerk publicMetadata. Assign role first, then bootstrap.")
    }
  } else if (clerkRole !== sessionResponse.role) {
    recommendations.push(`Role mismatch: Clerk has '${clerkRole}', Redis has '${sessionResponse.role}'. Use bootstrap API to sync.`)
  } else {
    recommendations.push("✅ Session is properly configured and roles match.")
    
    if (sessionResponse.updatedAt) {
      const ageHours = (new Date().getTime() - sessionResponse.updatedAt.getTime()) / (1000 * 60 * 60)
      if (ageHours > 24) {
        recommendations.push("Session is older than 24 hours but still valid (TTL: 30 days).")
      }
    }
  }

  if (sessionResponse.role === 'admin') {
    recommendations.push("✅ User has admin privileges and can access all admin routes.")
  } else if (sessionResponse.role) {
    recommendations.push(`User has '${sessionResponse.role}' role. Admin routes will be denied.`)
  }

  return recommendations
}