import { NextResponse } from "next/server"
import { z } from "zod"
import { connectDB } from "@/lib/db/connection"
import { OrderModel } from "@/lib/db/models/Order"
import { AuditLogModel } from "@/lib/db/models/AuditLog"
import { validateUTR, isOrderExpired } from "@/lib/utils/upi-utils"

const UtrSubmissionSchema = z.object({
  utr: z.string().refine(validateUTR, {
    message: "Invalid UTR format. UTR must be a 12-character alphanumeric string",
  }),
  paymentMethod: z.enum(["gpay", "phonepe", "paytm", "bhim", "other"]).optional(),
  notes: z.string().max(500).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    // Connect to database
    await connectDB()
    
    const { orderId } = await params
    const body = await request.json()
    const validatedData = UtrSubmissionSchema.parse(body)

    const order = await OrderModel.findOne({ orderId })
    if (!order) {
      return NextResponse.json({ 
        error: "Order not found",
        code: "ORDER_NOT_FOUND"
      }, { status: 404 })
    }

    // Check if order has expired
    if (isOrderExpired(order.expiresAt)) {
      // Update order status to expired
      order.status = "expired"
      await order.save()
      
      return NextResponse.json({ 
        error: "Order has expired",
        code: "ORDER_EXPIRED",
        expiresAt: order.expiresAt
      }, { status: 400 })
    }

    // Check if order is in correct status
    if (order.status !== "pending") {
      return NextResponse.json({ 
        error: `Order is not in pending status. Current status: ${order.status}`,
        code: "INVALID_ORDER_STATUS",
        currentStatus: order.status
      }, { status: 400 })
    }

    // Check if UTR is already used
    const existingOrder = await OrderModel.findOne({ 
      utrNumber: validatedData.utr,
      _id: { $ne: order._id }
    })
    
    if (existingOrder) {
      return NextResponse.json({ 
        error: "UTR number has already been used for another order",
        code: "UTR_ALREADY_EXISTS"
      }, { status: 400 })
    }

    // Update order with UTR information
    order.utrNumber = validatedData.utr
    order.status = "pending-verification"
    await order.save()

    // Create audit log
    await AuditLogModel.create({
      action: "utr_submitted",
      entityType: "Order",
      entityId: orderId,
      userId: "customer", // Customer submission
      userEmail: order.customerEmail || "",
      ipAddress: request.headers.get("x-forwarded-for") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      metadata: {
        orderId,
        utr: validatedData.utr,
        paymentMethod: validatedData.paymentMethod,
        notes: validatedData.notes,
        amount: order.amount,
      },
    })

    const response = {
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        utr: order.utrNumber,
        submittedAt: new Date().toISOString(),
        message: "UTR submitted successfully. Your payment is now under verification.",
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Validation failed", 
        details: error.errors,
        code: "VALIDATION_ERROR"
      }, { status: 400 })
    }

    console.error("[Orders API] UTR submission error:", error)
    return NextResponse.json(
      { 
        error: "Failed to submit UTR",
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    )
  }
}
