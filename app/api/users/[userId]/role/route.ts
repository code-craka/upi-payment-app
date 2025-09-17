import { NextRequest, NextResponse } from "next/server"
import { currentUser, clerkClient } from "@clerk/nextjs/server"
import { cacheUserRole, invalidateUserRole, updateRoleStats } from "@/lib/redis"
import { serverLogger } from "@/lib/utils/server-logger"
import { connectDB } from "@/lib/db/connection"
import { AuditLogModel } from "@/lib/db/models/AuditLog"
import type { UserRole } from "@/lib/types"

export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Authenticate admin user
    const adminUser = await currentUser()
    if (!adminUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const adminRole = adminUser.publicMetadata?.role as UserRole
    if (adminRole !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const targetUserId = params.userId
    if (!targetUserId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Parse request body
    const body = await request.json()
    const { role: newRole, reason } = body

    if (!newRole || !["admin", "merchant", "viewer"].includes(newRole)) {
      return NextResponse.json({
        error: "Invalid role",
        validRoles: ["admin", "merchant", "viewer"]
      }, { status: 400 })
    }

    // Get target user from Clerk
    const clerk = await clerkClient()
    const targetUser = await clerk.users.getUser(targetUserId)

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const oldRole = targetUser.publicMetadata?.role as UserRole || "viewer"

    // Prevent self-demotion for the last admin
    if (targetUserId === adminUser.id && newRole !== "admin") {
      // Check if there are other admins
      const allUsers = await clerk.users.getUserList({ limit: 500 })
      const adminCount = allUsers.data.filter(u =>
        u.publicMetadata?.role === "admin" && u.id !== targetUserId
      ).length

      if (adminCount === 0) {
        return NextResponse.json({
          error: "Cannot remove admin role from the last administrator"
        }, { status: 400 })
      }
    }

    // Connect to database for audit logging
    await connectDB()

    // Update role in Clerk
    await clerk.users.updateUser(targetUserId, {
      publicMetadata: {
        ...targetUser.publicMetadata,
        role: newRole,
        updatedBy: adminUser.id,
        updatedAt: new Date().toISOString(),
        updateReason: reason || "Role update via API"
      }
    })

    // Update role in Redis (dual write)
    await cacheUserRole(targetUserId, newRole, {
      source: 'clerk_api',
      updatedBy: adminUser.id,
      oldRole,
      newRole,
      reason: reason || "Role update via API",
      timestamp: Date.now()
    })

    // Update role statistics
    await updateRoleStats({
      userId: targetUserId,
      oldRole,
      newRole
    })

    // Invalidate old role cache to force refresh
    await invalidateUserRole(targetUserId)

    // Log audit event
    await AuditLogModel.create({
      action: 'user_role_updated',
      entityType: 'User',
      entityId: targetUserId,
      userId: adminUser.id,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      metadata: {
        oldRole,
        newRole,
        reason: reason || "Role update via API",
        targetUserEmail: targetUser.emailAddresses[0]?.emailAddress,
        dualWrite: true,
        sources: ['clerk', 'redis']
      }
    })

    serverLogger.info("User role updated with dual write", {
      targetUserId,
      adminUserId: adminUser.id,
      oldRole,
      newRole,
      sources: ['clerk', 'redis'],
      reason: reason || "Role update via API"
    })

    return NextResponse.json({
      success: true,
      message: "User role updated successfully",
      data: {
        userId: targetUserId,
        oldRole,
        newRole,
        updatedBy: adminUser.id,
        updatedAt: new Date().toISOString(),
        dualWrite: true
      }
    })

  } catch (error) {
    serverLogger.error("Failed to update user role", {
      targetUserId: params.userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json({
      error: "Failed to update user role",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Authenticate admin user
    const adminUser = await currentUser()
    if (!adminUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const adminRole = adminUser.publicMetadata?.role as UserRole
    if (adminRole !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const targetUserId = params.userId
    if (!targetUserId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Get user from Clerk
    const clerk = await clerkClient()
    const user = await clerk.users.getUser(targetUserId)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const clerkRole = user.publicMetadata?.role as UserRole || "viewer"

    return NextResponse.json({
      userId: targetUserId,
      role: clerkRole,
      source: 'clerk',
      metadata: {
        updatedBy: user.publicMetadata?.updatedBy,
        updatedAt: user.publicMetadata?.updatedAt,
        updateReason: user.publicMetadata?.updateReason
      }
    })

  } catch (error) {
    serverLogger.error("Failed to get user role", {
      targetUserId: params.userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json({
      error: "Failed to get user role",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}