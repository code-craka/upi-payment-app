import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getCachedUserRole, syncUserRole, testRedisConnection } from "@/lib/redis";
import { connectDB } from "@/lib/db/connection";
import { 
  type DebugSessionResponse,
  type UserRole,
  type RoleSyncStatus 
} from "@/lib/types";

/**
 * GET /api/debug/session
 * 
 * Debug endpoint to examine hybrid role management state
 * Shows Clerk vs Redis role synchronization status
 */
export async function GET(request: NextRequest): Promise<NextResponse<DebugSessionResponse | { error: string; details?: string }>> {
  try {
    const startTime = Date.now();
    
    // 1. Authentication check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({
        error: "Authentication Required",
        details: "User must be signed in to view session debug information"
      }, { status: 401 });
    }

    const userEmail = user.primaryEmailAddress?.emailAddress || "unknown";

    // 2. Test Redis connection first
    const redisTest = await testRedisConnection();
    const redisStartTime = Date.now();
    
    // 3. Get Clerk role data
    const clerkStartTime = Date.now();
    const clerkRole = user.publicMetadata?.role as UserRole || null;
    const clerkLatency = Date.now() - clerkStartTime;

    // 4. Get Redis cached role data
    const redisCacheStartTime = Date.now();
    const cachedRole = await getCachedUserRole(user.id);
    const redisLatency = Date.now() - redisCacheStartTime;

    // 5. Determine synchronization status
    const inSync = clerkRole === (cachedRole?.role || null);
    let discrepancy: string | undefined;
    let recommendation: string | undefined;

    if (!inSync) {
      if (!clerkRole && !cachedRole) {
        discrepancy = "No role assigned in either system";
        recommendation = "Assign role using admin bootstrap API";
      } else if (!clerkRole) {
        discrepancy = "Missing role in Clerk";
        recommendation = "Update Clerk publicMetadata or clear Redis cache";
      } else if (!cachedRole) {
        discrepancy = "Missing role in Redis cache";
        recommendation = "Role will be cached on next middleware execution or manual sync";
      } else {
        discrepancy = `Clerk has '${clerkRole}', Redis has '${cachedRole.role}'`;
        recommendation = "Use admin bootstrap API to synchronize roles";
      }
    }

    // 6. Build comprehensive debug response
    const debugResponse: DebugSessionResponse = {
      userId: user.id,
      userEmail,
      clerkData: {
        role: clerkRole,
        publicMetadata: user.publicMetadata || {},
        lastUpdated: user.updatedAt || null,
      },
      redisData: {
        cached: !!cachedRole,
        role: (cachedRole?.role as UserRole) || null,
        lastSync: cachedRole?.lastSync || null,
        sessionData: cachedRole ? {
          ...cachedRole,
          role: cachedRole.role as UserRole,
        } : null,
      },
      synchronization: {
        inSync,
        discrepancy,
        recommendation,
      },
      performance: {
        clerkLatency,
        redisLatency: redisTest.latency || redisLatency,
        totalLatency: Date.now() - startTime,
      },
      timestamp: Date.now(),
    };

    console.log(`[Debug] Session debug for user ${userEmail}:`, {
      userId: user.id,
      inSync,
      clerkRole,
      redisRole: cachedRole?.role || null,
      redisConnected: redisTest.connected,
      totalLatency: debugResponse.performance.totalLatency,
    });

    return NextResponse.json(debugResponse, { status: 200 });

  } catch (error) {
    console.error("[Debug] Session debug error:", error);
    
    return NextResponse.json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "An unexpected error occurred"
    }, { status: 500 });
  }
}

/**
 * POST /api/debug/session
 * 
 * Perform debug actions like role synchronization
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({
        error: "Authentication Required"
      }, { status: 401 });
    }

    // Check if user has admin role for debug actions
    const userRole = user.publicMetadata?.role as string;
    if (userRole !== "admin") {
      return NextResponse.json({
        error: "Admin Access Required",
        details: "Only admin users can perform debug actions"
      }, { status: 403 });
    }

    const body = await request.json();
    const { action, targetUserId } = body;

    if (!action) {
      return NextResponse.json({
        error: "Missing Action",
        details: "Action parameter is required",
        availableActions: ["sync", "refresh", "stats"]
      }, { status: 400 });
    }

    const userId = targetUserId || user.id;

    switch (action) {
      case "sync": {
        // Force sync a user's role from Clerk to Redis
        const clerkRole = user.publicMetadata?.role as UserRole;
        if (!clerkRole) {
          return NextResponse.json({
            error: "No Role to Sync",
            details: "User has no role assigned in Clerk"
          }, { status: 400 });
        }

        const synced = await syncUserRole(userId, clerkRole, true);
        
        return NextResponse.json({
          success: synced,
          message: synced ? "Role synchronized successfully" : "Failed to sync role",
          userId,
          role: clerkRole,
          timestamp: Date.now(),
        });
      }

      case "refresh": {
        // Refresh Redis connection and get fresh data
        const redisTest = await testRedisConnection();
        const cachedRole = await getCachedUserRole(userId);

        return NextResponse.json({
          success: true,
          message: "Debug session refreshed",
          redis: {
            connected: redisTest.connected,
            latency: redisTest.latency,
            error: redisTest.error,
          },
          cachedRole: cachedRole || null,
          timestamp: Date.now(),
        });
      }

      case "stats": {
        // Get Redis connection stats and health
        const redisTest = await testRedisConnection();
        
        return NextResponse.json({
          success: true,
          stats: {
            redis: redisTest,
            timestamp: Date.now(),
          },
        });
      }

      default:
        return NextResponse.json({
          error: "Invalid Action",
          details: `Action '${action}' is not supported`,
          availableActions: ["sync", "refresh", "stats"]
        }, { status: 400 });
    }

  } catch (error) {
    console.error("[Debug] Session POST error:", error);
    
    return NextResponse.json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * PUT /api/debug/session
 * 
 * Bulk role synchronization for all users (admin only)
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({
        error: "Authentication Required"
      }, { status: 401 });
    }

    // Check if user has admin role
    const userRole = user.publicMetadata?.role as string;
    if (userRole !== "admin") {
      return NextResponse.json({
        error: "Admin Access Required"
      }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action !== "bulk-sync") {
      return NextResponse.json({
        error: "Invalid Action",
        details: "Only 'bulk-sync' action is supported for PUT method"
      }, { status: 400 });
    }

    // This is a placeholder for bulk sync functionality
    // In a real implementation, you would:
    // 1. Get all users from Clerk
    // 2. Sync their roles to Redis
    // 3. Report on sync success/failures

    console.log(`[Debug] Bulk sync initiated by user ${user.id}`);

    return NextResponse.json({
      success: true,
      message: "Bulk synchronization completed",
      details: "This is a placeholder implementation",
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error("[Debug] Session PUT error:", error);
    
    return NextResponse.json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}