import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db/connection'
import { OrderModel } from '@/lib/db/models/Order'
import { PaymentLinkModel } from '@/lib/db/models/PaymentLink'
import { generateOrderId, calculateExpirationTime } from '@/lib/utils/upi-utils'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rate-limit'

const CreateOrderFromLinkSchema = z.object({
  linkId: z.string(),
  amount: z.number().min(1).max(100000),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, RATE_LIMIT_CONFIGS.orders)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: rateLimitResult.message,
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 }
      )
    }

    // Parse request body
    const body = await request.json()
    const validatedData = CreateOrderFromLinkSchema.parse(body)

    // Connect to database
    await connectDB()

    // Find the payment link
    const paymentLink = await PaymentLinkModel.findOne({
      linkId: validatedData.linkId,
      isActive: true,
    })

    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found or inactive' },
        { status: 404 }
      )
    }

    // Check if expired
    if (paymentLink.expiresAt && new Date() > paymentLink.expiresAt) {
      return NextResponse.json(
        { error: 'Payment link has expired' },
        { status: 400 }
      )
    }

    // Check usage limit
    if (paymentLink.usageLimit && paymentLink.usageCount >= paymentLink.usageLimit) {
      return NextResponse.json(
        { error: 'Payment link usage limit reached' },
        { status: 400 }
      )
    }

    // Validate amount constraints
    if (!paymentLink.allowCustomAmount && paymentLink.amount !== validatedData.amount) {
      return NextResponse.json(
        { error: 'Amount does not match the fixed amount for this payment link' },
        { status: 400 }
      )
    }

    if (paymentLink.allowCustomAmount) {
      if (paymentLink.minAmount && validatedData.amount < paymentLink.minAmount) {
        return NextResponse.json(
          { error: `Amount must be at least ₹${paymentLink.minAmount}` },
          { status: 400 }
        )
      }

      if (paymentLink.maxAmount && validatedData.amount > paymentLink.maxAmount) {
        return NextResponse.json(
          { error: `Amount cannot exceed ₹${paymentLink.maxAmount}` },
          { status: 400 }
        )
      }
    }

    // Generate order ID and expiration time
    const orderId = generateOrderId()
    const expiresAt = calculateExpirationTime(9) // 9 minutes

    // Create order
    const orderData = {
      orderId,
      amount: validatedData.amount,
      description: paymentLink.description || `Payment for ${paymentLink.title}`,
      customerName: validatedData.customerName,
      customerEmail: validatedData.customerEmail,
      customerPhone: validatedData.customerPhone,
      upiId: paymentLink.upiId,
      status: 'pending' as const,
      createdBy: paymentLink.createdBy,
      expiresAt,
      paymentLinkId: paymentLink.linkId, // Track which payment link created this order
    }

    console.log('Creating order from payment link:', JSON.stringify(orderData, null, 2))

    const order = await OrderModel.create(orderData)

    // Increment usage count for the payment link
    await PaymentLinkModel.findByIdAndUpdate(paymentLink._id, {
      $inc: { usageCount: 1 },
      $set: { 'stats.lastUsedAt': new Date() }
    })

    const response = {
      success: true,
      data: {
        orderId: order.orderId,
        amount: order.amount,
        description: order.description,
        status: order.status,
        expiresAt: order.expiresAt,
        paymentUrl: `/pay/${order.orderId}`,
        timeRemaining: expiresAt.getTime() - Date.now(), // milliseconds
      },
      message: 'Order created successfully from payment link',
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    console.error('[Payment Links] Create order error:', error)

    return NextResponse.json(
      {
        error: 'Failed to create order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}