import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db/connection'
import { OrderModel } from '@/lib/db/models/Order'
import { AuditLogModel } from '@/lib/db/models/AuditLog'

const utrSubmissionSchema = z.object({
  utr: z.string().min(12).max(22),
  paymentMethod: z.enum(['phonepe', 'paytm', 'googlepay', 'upi', 'other']).optional().default('upi'),
  notes: z.string().max(500).optional(),
})

const isOrderExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    // Rate limiting - TEMPORARILY DISABLED FOR DEBUG
    // const rateLimitResult = await rateLimit(request, RATE_LIMIT_CONFIGS.utr)
    
    // if (!rateLimitResult.success) {
    //   return NextResponse.json(
    //     {
    //       error: rateLimitResult.message,
    //       code: 'RATE_LIMIT_EXCEEDED',
    //       remaining: rateLimitResult.remaining,
    //       resetTime: rateLimitResult.resetTime.toISOString(),
    //     },
    //     { 
    //       status: 429,
    //       headers: {
    //         'X-RateLimit-Limit': rateLimitResult.limit.toString(),
    //         'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
    //         'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString(),
    //       }
    //     }
    //   )
    // }

    // Connect to database
    await connectDB()

    const { orderId } = await context.params
    console.error('UTR API: Received orderId:', orderId, typeof orderId)
    
    // STEP 1: Just try to parse the body
    const body = await request.json()
    console.error('UTR API: Raw body:', body)
    
    // STEP 2: Try validation
    const validatedData = utrSubmissionSchema.parse(body)
    console.error('UTR API: Validated UTR data:', validatedData)

    // STEP 3: Try finding the order
    console.error('UTR API: About to search for order with orderId:', orderId)
    const order = await OrderModel.findOne({ orderId: String(orderId) })
    console.error('UTR API: Found order:', order ? 'YES' : 'NO')
    
    if (!order) {
      return NextResponse.json(
        {
          error: 'Order not found',
          code: 'ORDER_NOT_FOUND',
        },
        { status: 404 }
      )
    }

    // Check if order has expired
    if (isOrderExpired(order.expiresAt)) {
      // Update order status to expired
      order.status = 'expired'
      await order.save()

      return NextResponse.json(
        {
          error: 'Order has expired',
          code: 'ORDER_EXPIRED',
          expiresAt: order.expiresAt,
        },
        { status: 400 }
      )
    }

    // Check if order is in correct status
    if (order.status !== 'pending') {
      return NextResponse.json(
        {
          error: `Order is not in pending status. Current status: ${order.status}`,
          code: 'INVALID_ORDER_STATUS',
          currentStatus: order.status,
        },
        { status: 400 }
      )
    }

    // Check if UTR already exists for this order
    if (order.utrNumber) {
      return NextResponse.json(
        {
          error: 'UTR already submitted for this order',
          code: 'UTR_ALREADY_SUBMITTED',
          existingUtr: order.utrNumber,
        },
        { status: 400 }
      )
    }

    // Check if UTR is already used by another order
    console.error('UTR API: About to check for duplicate UTR. Order._id type:', typeof order._id, 'Order._id:', order._id)
    
    // Convert ObjectId to string to avoid casting issues
    const orderIdStr = order._id?.toString() || order._id
    
    const existingOrder = await OrderModel.findOne({
      utrNumber: validatedData.utr.toUpperCase(),
      _id: { $ne: orderIdStr },
    })
    
    console.error('UTR API: Duplicate check completed')

    if (existingOrder) {
      return NextResponse.json(
        {
          error: 'UTR number has already been used for another order',
          code: 'UTR_ALREADY_EXISTS',
        },
        { status: 400 }
      )
    }

    // Update order with UTR information
    console.error('UTR API: About to update order. orderId type:', typeof orderId, 'orderId value:', orderId)
    console.error('UTR API: Order _id:', order._id)
    
    order.utrNumber = validatedData.utr.toUpperCase()
    order.status = 'pending-verification'
    
    console.error('UTR API: About to save order')
    await order.save()
    console.error('UTR API: Order saved successfully')

    // Get IP address for audit log
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    console.error('UTR API: About to create audit log')
    // Create audit log
    await AuditLogModel.create({
      action: 'utr_submitted',
      entityType: 'Order',
      entityId: String(orderId), // Ensure it's a string
      userId: 'customer', // Customer submission
      userEmail: order.customerEmail || 'customer@example.com', // Fallback email
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        orderId: String(orderId), // Ensure it's a string
        utr: validatedData.utr.toUpperCase(),
        paymentMethod: validatedData.paymentMethod,
        notes: validatedData.notes,
        amount: order.amount,
        customerName: order.customerName,
      },
    })

    const response = {
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        utr: order.utrNumber,
        submittedAt: new Date().toISOString(),
        message: 'UTR submitted successfully. Your payment is now under verification.',
      },
    }

    return NextResponse.json(response)
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

    console.error('[UTR API] Detailed error information:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type',
      orderId: 'orderId not available',
    })
    
    return NextResponse.json(
      {
        error: 'Failed to submit UTR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check UTR status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    await connectDB()

    const order = await OrderModel.findOne({ orderId }).select(
      'orderId utrNumber status amount expiresAt'
    )

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.orderId,
        hasUtr: !!order.utrNumber,
        utr: order.utrNumber,
        status: order.status,
        amount: order.amount,
        expiresAt: order.expiresAt,
        isExpired: isOrderExpired(order.expiresAt),
      }
    })

  } catch (error) {
    console.error('Error fetching UTR status:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
