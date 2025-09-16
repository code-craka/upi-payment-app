import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/db/connection"
import { OrderModel } from "@/lib/db/models/Order" 
import { AuditLogModel } from "@/lib/db/models/AuditLog"

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser()
    
    // Allow unauthenticated access for system diagnostics
    const isAuthenticated = !!user

    // Test database connection
    await connectDB()
    
    // Check collections
    const orderCount = await OrderModel.countDocuments()
    const auditCount = await AuditLogModel.countDocuments()
    
    // Check user role status if authenticated
    const userRole = user?.publicMetadata?.role as string
    
    const systemStatus = {
      database: {
        connected: true,
        collections: {
          orders: orderCount,
          auditLogs: auditCount
        }
      },
      user: isAuthenticated ? {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        role: userRole,
        hasRole: !!userRole,
        metadata: user.publicMetadata
      } : {
        authenticated: false,
        message: "No user session"
      },
      environment: {
        mongoUri: process.env.MONGODB_URI ? "✓ Configured" : "✗ Missing",
        clerkKeys: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY ? "✓ Configured" : "✗ Missing"
      }
    }

    return NextResponse.json({
      success: true,
      status: "System operational",
      data: systemStatus
    })

  } catch (error) {
    console.error("System status check failed:", error)
    return NextResponse.json({
      success: false,
      error: "System check failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}