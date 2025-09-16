import { NextResponse } from "next/server"
import { headers } from "next/headers"
import crypto from "crypto"
import { z } from "zod"
import { connectDB } from "@/lib/db/connection"
import { OrderModel } from "@/lib/db/models/Order"
import { AuditLogModel } from "@/lib/db/models/AuditLog"

// Webhook payload schemas for different events
const PaymentConfirmationSchema = z.object({
  event: z.literal("payment.confirmed"),
  data: z.object({
    orderId: z.string(),
    utr: z.string(),
    amount: z.number(),
    paymentMethod: z.string(),
    paymentTime: z.string(),
    bankReferenceNumber: z.string().optional(),
    payerVPA: z.string().optional(),
  }),
  timestamp: z.string(),
  signature: z.string(),
})

const PaymentFailedSchema = z.object({
  event: z.literal("payment.failed"),
  data: z.object({
    orderId: z.string(),
    reason: z.string(),
    errorCode: z.string().optional(),
  }),
  timestamp: z.string(),
  signature: z.string(),
})

const OrderStatusUpdateSchema = z.object({
  event: z.literal("order.status_updated"),
  data: z.object({
    orderId: z.string(),
    previousStatus: z.string(),
    currentStatus: z.string(),
    updatedBy: z.string(),
    notes: z.string().optional(),
  }),
  timestamp: z.string(),
  signature: z.string(),
})

/**
 * Verify webhook signature to ensure it's from a trusted source
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  const receivedSignature = signature.replace('sha256=', '')
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  )
}

/**
 * Handle payment confirmation webhook
 */
async function handlePaymentConfirmation(data: z.infer<typeof PaymentConfirmationSchema>['data']) {
  await connectDB()
  
  const order = await OrderModel.findOne({ orderId: data.orderId })
  if (!order) {
    throw new Error(`Order ${data.orderId} not found`)
  }

  // Verify amount matches
  if (order.amount !== data.amount) {
    throw new Error(`Amount mismatch for order ${data.orderId}: expected ${order.amount}, received ${data.amount}`)
  }

  // Update order status to completed
  const previousStatus = order.status
  order.status = "completed"
  order.utrNumber = data.utr
  order.verifiedAt = new Date()
  order.verifiedBy = "system_webhook"
  await order.save()

  // Create audit log
  await AuditLogModel.create({
    action: "payment_confirmed",
    entityType: "Order",
    entityId: data.orderId,
    userId: "system_webhook",
    userEmail: "system@webhook.com",
    ipAddress: "webhook",
    userAgent: "webhook",
    metadata: {
      orderId: data.orderId,
      utr: data.utr,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      paymentTime: data.paymentTime,
      bankReferenceNumber: data.bankReferenceNumber,
      payerVPA: data.payerVPA,
      previousStatus,
      newStatus: "completed",
    },
  })

  return {
    orderId: data.orderId,
    status: "completed",
    message: "Payment confirmed and order completed",
  }
}

/**
 * Handle payment failure webhook
 */
async function handlePaymentFailed(data: z.infer<typeof PaymentFailedSchema>['data']) {
  await connectDB()
  
  const order = await OrderModel.findOne({ orderId: data.orderId })
  if (!order) {
    throw new Error(`Order ${data.orderId} not found`)
  }

  // Update order status to failed
  const previousStatus = order.status
  order.status = "failed"
  await order.save()

  // Create audit log
  await AuditLogModel.create({
    action: "payment_failed",
    entityType: "Order",
    entityId: data.orderId,
    userId: "system_webhook",
    userEmail: "system@webhook.com",
    ipAddress: "webhook",
    userAgent: "webhook",
    metadata: {
      orderId: data.orderId,
      reason: data.reason,
      errorCode: data.errorCode,
      previousStatus,
      newStatus: "failed",
    },
  })

  return {
    orderId: data.orderId,
    status: "failed",
    message: "Payment failed",
  }
}

/**
 * Handle order status update webhook
 */
async function handleOrderStatusUpdate(data: z.infer<typeof OrderStatusUpdateSchema>['data']) {
  await connectDB()
  
  const order = await OrderModel.findOne({ orderId: data.orderId })
  if (!order) {
    throw new Error(`Order ${data.orderId} not found`)
  }

  // Update order status
  order.status = data.currentStatus as any
  if (data.currentStatus === "completed") {
    order.verifiedAt = new Date()
    order.verifiedBy = data.updatedBy
  }
  await order.save()

  // Create audit log
  await AuditLogModel.create({
    action: "order_status_updated_webhook",
    entityType: "Order",
    entityId: data.orderId,
    userId: data.updatedBy,
    userEmail: "system@webhook.com",
    ipAddress: "webhook",
    userAgent: "webhook",
    metadata: {
      orderId: data.orderId,
      previousStatus: data.previousStatus,
      currentStatus: data.currentStatus,
      updatedBy: data.updatedBy,
      notes: data.notes,
    },
  })

  return {
    orderId: data.orderId,
    status: data.currentStatus,
    message: "Order status updated via webhook",
  }
}

export async function POST(request: Request) {
  try {
    const headersList = await headers()
    const signature = headersList.get("x-webhook-signature") || headersList.get("signature") || ""
    const payload = await request.text()

    // Verify webhook signature
    const webhookSecret = process.env.WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error("WEBHOOK_SECRET not configured")
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
      console.error("Invalid webhook signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // Parse the payload
    const data = JSON.parse(payload)
    let result

    switch (data.event) {
      case "payment.confirmed":
        const paymentData = PaymentConfirmationSchema.parse(data)
        result = await handlePaymentConfirmation(paymentData.data)
        break

      case "payment.failed":
        const failureData = PaymentFailedSchema.parse(data)
        result = await handlePaymentFailed(failureData.data)
        break

      case "order.status_updated":
        const statusData = OrderStatusUpdateSchema.parse(data)
        result = await handleOrderStatusUpdate(statusData.data)
        break

      default:
        return NextResponse.json(
          { error: `Unknown event type: ${data.event}` },
          { status: 400 }
        )
    }

    console.log(`[Webhook] Successfully processed ${data.event} for order ${result.orderId}`)
    
    return NextResponse.json({
      success: true,
      event: data.event,
      result,
      processedAt: new Date().toISOString(),
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("[Webhook] Validation error:", error.errors)
      return NextResponse.json(
        { 
          error: "Invalid webhook payload", 
          details: error.errors 
        },
        { status: 400 }
      )
    }

    console.error("[Webhook] Error processing webhook:", error)
    return NextResponse.json(
      { 
        error: "Failed to process webhook",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "active",
    webhook: "payment-webhook",
    timestamp: new Date().toISOString(),
    events: [
      "payment.confirmed",
      "payment.failed", 
      "order.status_updated"
    ],
  })
}