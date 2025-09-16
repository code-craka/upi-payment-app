import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { z } from "zod"
import { connectDB } from "@/lib/db/connection"
import { OrderModel } from "@/lib/db/models/Order"
import { createAuditLogFromRequest } from "@/lib/utils/audit"
import { hasPermission } from "@/lib/types"

const StatusUpdateSchema = z.object({
  status: z.enum(["pending", "pending-verification", "completed", "failed", "expired"]),
  adminNotes: z.string().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRole = user.publicMetadata?.role as "admin" | "merchant" | "viewer"
    if (!hasPermission(userRole, "verify_orders")) {
      return NextResponse.json({ 
        error: "Insufficient permissions to manage orders",
        code: "PERMISSION_DENIED" 
      }, { status: 403 })
    }

    await connectDB()

    const { orderId } = await params
    const body = await request.json()

    const validatedData = StatusUpdateSchema.parse(body)

    // Find the existing order
    const order = await OrderModel.findOne({ orderId })
    if (!order) {
      return NextResponse.json({ 
        error: "Order not found",
        code: "ORDER_NOT_FOUND" 
      }, { status: 404 })
    }

    const previousStatus = order.status

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      "pending": ["pending-verification", "failed", "expired"],
      "pending-verification": ["completed", "failed"],
      "completed": [], // Final state
      "failed": ["pending", "pending-verification"],
      "expired": ["pending", "pending-verification"]
    }

    if (!validTransitions[previousStatus].includes(validatedData.status)) {
      return NextResponse.json({
        error: `Invalid status transition from '${previousStatus}' to '${validatedData.status}'`,
        code: "INVALID_STATUS_TRANSITION"
      }, { status: 400 })
    }

    // Update order
    order.status = validatedData.status
    if (validatedData.adminNotes) {
      order.adminNotes = validatedData.adminNotes
    }

    // Set completion timestamp if status is completed
    if (validatedData.status === "completed" && previousStatus !== "completed") {
      order.completedAt = new Date()
    }

    order.updatedAt = new Date()
    await order.save()

    // Create audit log
    await createAuditLogFromRequest(
      request,
      "order_status_updated_by_admin",
      "Order",
      order.orderId,
      user.id,
      user.emailAddresses[0]?.emailAddress || "",
      {
        previousStatus,
        newStatus: validatedData.status,
        adminNotes: validatedData.adminNotes,
        customerName: order.customerName,
        amount: order.amount,
        utrNumber: order.utrNumber,
      }
    )

    const response = {
      success: true,
      message: "Order status updated successfully",
      data: {
        orderId: order.orderId,
        status: order.status,
        previousStatus,
        updatedAt: order.updatedAt,
        updatedBy: user.id,
        adminNotes: order.adminNotes,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid request data", 
        details: error.errors,
        code: "VALIDATION_ERROR"
      }, { status: 400 })
    }

    console.error("[Admin API] Status update error:", error)

    // Create security audit log for failed admin operation
    try {
      const user = await currentUser()
      if (user) {
        const { orderId: paramOrderId } = await params
        await createAuditLogFromRequest(
          request,
          "admin_order_update_failed",
          "Order",
          paramOrderId,
          user.id,
          user.emailAddresses[0]?.emailAddress || "",
          {
            error: error instanceof Error ? error.message : "Unknown error",
            requestBody: await request.json().catch(() => ({})),
          }
        )
      }
    } catch (auditError) {
      console.error("[Admin API] Failed to create audit log:", auditError)
    }

    return NextResponse.json({ 
      error: "Failed to update order status",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
