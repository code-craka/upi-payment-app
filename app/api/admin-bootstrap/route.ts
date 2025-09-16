import { NextRequest, NextResponse } from "next/server"
import { createClerkClient } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/db/connection"
import { setSession, getSessionResponse, delSession } from "@/lib/session/redis"
import { serverLogger } from "@/lib/utils/server-logger"
import { UserRoleSchema, type UserRole } from "@/lib/types"
import { z } from "zod"
import type { User } from "@clerk/nextjs/server"

interface UserPublicMetadata {
  role?: string;
}

// Request validation schema
const BootstrapRequestSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  action: z.enum(["make-admin", "make-merchant", "remove-role"]).default("make-admin")
}).refine(
  (data) => data.userId || data.email,
  {
    message: "Either userId or email is required",
    path: ["userId", "email"]
  }
)

const clerk = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY 
})

// This endpoint helps bootstrap the first admin user
// In production, you should secure this or remove after first use
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = BootstrapRequestSchema.parse(body)
    const { userId, email, action } = validatedData

    await connectDB()

    let user
    if (userId) {
      user = await clerk.users.getUser(userId)
    } else if (email) {
      const users = await clerk.users.getUserList({
        emailAddress: [email]
      })
      user = users.data[0]
    }

    if (!user) {
      return NextResponse.json(
        { 
          error: "User not found",
          message: "No user found with the provided userId or email"
        },
        { status: 404 }
      )
    }

    const previousRole = (user.publicMetadata as UserPublicMetadata)?.role || "none"

    // Handle role removal
    if (action === "remove-role") {
      // Update Clerk metadata
      await clerk.users.updateUser(user.id, {
        publicMetadata: {
          ...user.publicMetadata,
          role: undefined
        }
      })

      // Delete Redis session
      const sessionDeleted = await delSession(user.id)
      
      serverLogger.info("User role removed", {
        userId: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        previousRole,
        sessionDeleted
      })

      return NextResponse.json({
        success: true,
        message: `User ${user.emailAddresses[0]?.emailAddress} role has been removed`,
        data: {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress,
          role: null,
          previousRole,
          sessionDeleted
        }
      })
    }

    // Assign new role
    const role: UserRole = action === "make-admin" ? "admin" : "merchant"
    
    // Validate the role
    const validatedRole = UserRoleSchema.parse(role)
    
    // Invalidate any existing session before setting new role
    const sessionInvalidated = await delSession(user.id)
    
    serverLogger.info("Previous session invalidated before role change", {
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      newRole: validatedRole,
      previousRole,
      sessionInvalidated
    })
    
    // Update Clerk metadata (backup/initial source)
    await clerk.users.updateUser(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        role: validatedRole
      }
    })

    // Set Redis session (primary source of truth)
    const sessionSet = await setSession(user.id, {
      role: validatedRole,
      permissions: [] // Permissions are now auto-assigned based on role mapping
    })

    if (!sessionSet) {
      serverLogger.error("Failed to set Redis session for user", {
        userId: user.id,
        role: validatedRole
      })
      
      return NextResponse.json({
        success: false,
        error: "Role assignment partially failed",
        message: "User role updated in Clerk but failed to set session. Please try again.",
        details: "Redis session creation failed"
      }, { status: 500 })
    }

    // Get session response for verification
    const sessionResponse = await getSessionResponse(user.id)

    serverLogger.info("User role assigned successfully", {
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      newRole: validatedRole,
      previousRole,
      sessionSet,
      sessionData: sessionResponse
    })

    return NextResponse.json({
      success: true,
      message: `User ${user.emailAddresses[0]?.emailAddress} has been assigned ${validatedRole} role`,
      data: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        role: validatedRole,
        previousRole,
        sessionSet,
        sessionData: sessionResponse
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      serverLogger.warn("Bootstrap API validation error", {
        errors: error.errors
      })
      return NextResponse.json({
        success: false,
        error: "Validation Error",
        message: "Invalid request data",
        details: error.errors
      }, { status: 400 })
    }

    serverLogger.error("Role assignment failed", error)
    return NextResponse.json({
      success: false,
      error: "Role assignment failed",
      message: "An unexpected error occurred while assigning the role",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// Get current user role status
export async function GET() {
  try {
    await connectDB()
    
    // Get all users and their roles from Clerk
    const users = await clerk.users.getUserList({ limit: 50 })
    
    // Fetch Redis session data for each user
    const userListPromises = users.data.map(async (user: User) => {
      const sessionResponse = await getSessionResponse(user.id)
      
      return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        clerkRole: user.publicMetadata?.role || "no-role",
        sessionRole: sessionResponse.role || "no-session",
        hasSession: sessionResponse.hasSession,
        sessionUpdatedAt: sessionResponse.updatedAt,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        // Flag if there's a mismatch between Clerk and Redis
        rolesMismatch: (user.publicMetadata?.role || null) !== (sessionResponse.role || null)
      }
    })

    const userList = await Promise.all(userListPromises)

    const adminCount = userList.filter((u) => u.sessionRole === "admin").length
    const needsBootstrap = adminCount === 0
    const mismatches = userList.filter((u) => u.rolesMismatch)

    serverLogger.info("User list retrieved", {
      totalUsers: userList.length,
      adminCount,
      needsBootstrap,
      mismatches: mismatches.length
    })

    return NextResponse.json({
      success: true,
      needsBootstrap,
      adminCount,
      totalUsers: userList.length,
      users: userList,
      mismatches: mismatches.length > 0 ? mismatches : undefined,
      stats: {
        usersWithSessions: userList.filter(u => u.hasSession).length,
        usersWithoutSessions: userList.filter(u => !u.hasSession).length,
        rolesMismatches: mismatches.length
      }
    })

  } catch (error) {
    serverLogger.error("User list failed", error)
    return NextResponse.json({
      success: false,
      error: "Failed to get user list",
      message: "An unexpected error occurred while retrieving user information",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}