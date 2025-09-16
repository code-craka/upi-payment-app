import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { z } from "zod"
import { connectDB } from "@/lib/db/connection"
import { AuditLogModel } from "@/lib/db/models/AuditLog"
import { serverLogger } from "@/lib/utils/server-logger"

// Request validation schema
const adminTestRequestSchema = z.object({
  action: z.string().min(1, "Action is required"),
  data: z.record(z.unknown()).optional(),
})

/**
 * Admin Test API Route
 * Demonstrates proper server-side role validation and audit logging
 * Protected route requiring exact "admin" role
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication check
    const user = await currentUser()
    if (!user) {
      serverLogger.middleware("Unauthenticated API access attempt", {
        endpoint: "/api/admin/test",
        method: "POST"
      })
      return NextResponse.json({ 
        error: "Authentication Required",
        message: "You must be signed in to access this resource"
      }, { status: 401 })
    }

    // 2. Role validation - exact "admin" role required
    const userRole = user.publicMetadata?.role as string
    if (userRole !== "admin") {
      serverLogger.middleware("Insufficient privileges for admin API", {
        endpoint: "/api/admin/test",
        userId: user.id,
        userRole: userRole || 'undefined',
        requiredRole: 'admin'
      })
      return NextResponse.json({
        error: "Access Denied",
        message: "Admin privileges required to access this resource",
        requiredRole: "admin",
        currentRole: userRole || null
      }, { status: 403 })
    }

    // 3. Request validation
    const body = await request.json()
    const validatedData = adminTestRequestSchema.parse(body)

    // 4. Database connection
    await connectDB()

    // 5. Business logic - this is just a test endpoint
    const testResult = {
      success: true,
      timestamp: new Date().toISOString(),
      action: validatedData.action,
      adminUser: {
        id: user.id,
        email: user.emailAddresses?.[0]?.emailAddress,
        role: userRole,
      },
      requestData: validatedData.data,
    }

    // 6. Audit logging
    await AuditLogModel.create({
      action: 'admin_test_executed',
      entityType: 'AdminTest',
      entityId: `test-${Date.now()}`,
      userId: user.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      metadata: {
        endpoint: '/api/admin/test',
        requestAction: validatedData.action,
        userAgent: request.headers.get('user-agent'),
      },
    })

    // 7. Success logging
    serverLogger.info("Admin test API executed successfully", {
      userId: user.id,
      action: validatedData.action
    })

    // 8. Success response
    return NextResponse.json({
      success: true,
      message: "Admin test executed successfully",
      data: testResult
    }, { status: 200 })

  } catch (error) {
    // Enhanced error handling with proper logging
    if (error instanceof z.ZodError) {
      serverLogger.warn("Admin test API validation error", {
        errors: error.errors
      })
      return NextResponse.json({
        error: "Validation Error",
        message: "Invalid request data",
        details: error.errors
      }, { status: 400 })
    }

    serverLogger.error("Admin test API internal error", error)
    return NextResponse.json({
      error: "Internal Server Error",
      message: "An unexpected error occurred while processing your request"
    }, { status: 500 })
  }
}

/**
 * GET endpoint for admin status check
 * Simpler validation for read-only operations
 */
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ 
        error: "Authentication Required" 
      }, { status: 401 })
    }

    const userRole = user.publicMetadata?.role as string
    if (userRole !== "admin") {
      return NextResponse.json({
        error: "Access Denied",
        requiredRole: "admin",
        currentRole: userRole || null
      }, { status: 403 })
    }

    // Return admin status information
    return NextResponse.json({
      success: true,
      admin: {
        id: user.id,
        email: user.emailAddresses?.[0]?.emailAddress,
        role: userRole,
        lastSignIn: user.lastSignInAt,
      },
      timestamp: new Date().toISOString(),
      endpoint: "/api/admin/test"
    }, { status: 200 })

  } catch (error) {
    serverLogger.error("Admin test GET API error", error)
    return NextResponse.json({
      error: "Internal Server Error"
    }, { status: 500 })
  }
}