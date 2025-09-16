import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/db/connection"
import { OrderModel } from "@/lib/db/models/Order"
import { AuditLogModel } from "@/lib/db/models/AuditLog"
import { isOrderExpired } from "@/lib/utils/upi-utils"

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    // Connect to database
    await connectDB()
    
    const { orderId } = await params
    const order = await OrderModel.findOne({ orderId })

    if (!order) {
      return NextResponse.json({ 
        error: "Order not found",
        code: "ORDER_NOT_FOUND" 
      }, { status: 404 })
    }

    // Check if order has expired and update status
    if (order.status === "pending" && isOrderExpired(order.expiresAt)) {
      order.status = "expired"
      await order.save()
    }

    // Calculate time remaining
    const timeRemaining = order.status === "pending" ? 
      Math.max(0, order.expiresAt.getTime() - Date.now()) : 0

    const response = {
      success: true,
      data: {
        orderId: order.orderId,
        amount: order.amount,
        description: order.description,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        status: order.status,
        utrNumber: order.utrNumber,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        verifiedAt: order.verifiedAt,
        verifiedBy: order.verifiedBy,
        timeRemaining,
        paymentUrl: `/pay/${order.orderId}`,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Orders API] Get order error:", error)
    return NextResponse.json(
      { 
        error: "Failed to fetch order",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    // Connect to database
    await connectDB()
    
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = user.publicMetadata?.role as string
    if (!["admin"].includes(userRole)) {
      return NextResponse.json({ 
        error: "Insufficient permissions",
        code: "ADMIN_REQUIRED"
      }, { status: 403 })
    }

    const { orderId } = await params
    const body = await request.json()
    const { status, notes } = body

    const order = await OrderModel.findOne({ orderId })
    if (!order) {
      return NextResponse.json({ 
        error: "Order not found",
        code: "ORDER_NOT_FOUND"
      }, { status: 404 })
    }

    // Store previous status for audit log
    const previousStatus = order.status

    // Update order status
    if (status) {
      order.status = status
      if (status === "completed") {
        order.verifiedAt = new Date()
        order.verifiedBy = user.id
      }
    }

    await order.save()

    // Create audit log
    await AuditLogModel.create({
      action: "order_status_updated",
      entityType: "Order",
      entityId: orderId,
      userId: user.id,
      userEmail: user.emailAddresses[0]?.emailAddress || "",
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      metadata: {
        previousStatus,
        newStatus: status,
        notes,
        orderId,
        amount: order.amount,
      },
    })

    const response = {
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        verifiedAt: order.verifiedAt,
        verifiedBy: order.verifiedBy,
        updatedAt: order.updatedAt,
      },
      message: `Order ${orderId} status updated to ${status}`,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Orders API] Update order error:", error)
    return NextResponse.json(
      { 
        error: "Failed to update order",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}
