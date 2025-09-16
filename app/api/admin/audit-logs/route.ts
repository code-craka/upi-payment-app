import { type NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/db/connection"
import { AuditLogModel } from "@/lib/db/models/AuditLog"
import { getSession } from "@/lib/session/redis"
import { serverLogger } from "@/lib/utils/server-logger"
import { z } from "zod"
import type { Types } from "mongoose"

// Query parameters validation schema
const AuditLogQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  action: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

/**
 * Get audit logs - Admin only endpoint using Redis session validation
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authentication check
    const user = await currentUser()

    if (!user) {
      serverLogger.middleware("Unauthenticated audit log API access", {
        endpoint: "/api/admin/audit-logs"
      })
      return NextResponse.json({ 
        error: "Authentication Required",
        message: "You must be signed in to access this resource"
      }, { status: 401 })
    }

    // 2. Role validation from Redis session (primary source of truth)
    const session = await getSession(user.id)
    if (!session) {
      serverLogger.middleware("No Redis session for audit log access", {
        endpoint: "/api/admin/audit-logs",
        userId: user.id,
        email: user.emailAddresses?.[0]?.emailAddress
      })
      return NextResponse.json({
        error: "Session Not Found",
        message: "User session not initialized. Please contact administrator.",
        needsBootstrap: true
      }, { status: 403 })
    }

    if (session.role !== "admin") {
      serverLogger.middleware("Insufficient privileges for audit log access", {
        endpoint: "/api/admin/audit-logs",
        userId: user.id,
        currentRole: session.role,
        requiredRole: "admin"
      })
      return NextResponse.json({
        error: "Access Denied",
        message: "Admin privileges required to access audit logs",
        requiredRole: "admin",
        currentRole: session.role
      }, { status: 403 })
    }

    // 3. Query validation
    const { searchParams } = new URL(request.url)
    const queryData = {
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      action: searchParams.get("action"),
      entityType: searchParams.get("entityType"),
      userId: searchParams.get("userId"),
      dateFrom: searchParams.get("dateFrom"),
      dateTo: searchParams.get("dateTo"),
    }

    const validatedQuery = AuditLogQuerySchema.parse(queryData)

    await connectDB()

    // Build query
    const query: Record<string, unknown> = {}

    if (validatedQuery.action && validatedQuery.action !== "all") {
      query.action = validatedQuery.action
    }

    if (validatedQuery.entityType && validatedQuery.entityType !== "all") {
      query.entityType = validatedQuery.entityType
    }

    if (validatedQuery.userId) {
      query.userId = validatedQuery.userId
    }

    if (validatedQuery.dateFrom || validatedQuery.dateTo) {
      query.createdAt = {}
      if (validatedQuery.dateFrom) {
        (query.createdAt as Record<string, unknown>).$gte = new Date(validatedQuery.dateFrom)
      }
      if (validatedQuery.dateTo) {
        (query.createdAt as Record<string, unknown>).$lte = new Date(validatedQuery.dateTo)
      }
    }

    const skip = (validatedQuery.page - 1) * validatedQuery.limit

    const [logs, total] = await Promise.all([
      AuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(validatedQuery.limit).lean(),
      AuditLogModel.countDocuments(query),
    ])

    const formattedLogs = logs.map((log) => ({
      ...log,
      id: (log._id as Types.ObjectId).toString(),
      _id: undefined,
    }))

    // Success logging
    serverLogger.info("Audit logs retrieved successfully", {
      userId: user.id,
      role: session.role,
      totalLogs: total,
      returnedLogs: formattedLogs.length,
      page: validatedQuery.page
    })

    return NextResponse.json({
      success: true,
      logs: formattedLogs,
      pagination: {
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        total,
        pages: Math.ceil(total / validatedQuery.limit),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      serverLogger.warn("Audit logs API validation error", {
        errors: error.errors
      })
      return NextResponse.json({
        error: "Validation Error",
        message: "Invalid query parameters",
        details: error.errors
      }, { status: 400 })
    }

    serverLogger.error("Audit logs API internal error", error)
    return NextResponse.json({ 
      error: "Internal server error",
      message: "An unexpected error occurred while retrieving audit logs" 
    }, { status: 500 })
  }
}
