import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { connectDB } from '@/lib/db/connection'
import { OrderModel } from '@/lib/db/models/Order'
import { generateOrderId, calculateExpirationTime } from '@/lib/utils/upi-utils'
import { rateLimit, RATE_LIMIT_CONFIGS } from '@/lib/utils/rate-limit'

const CreateOrderSchema = z.object({
  amount: z.number().min(1).max(100000),
  description: z.string().max(500),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  upiId: z.string().optional(),
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
    const validatedData = CreateOrderSchema.parse(body)

    // Connect to database
    await connectDB()

    // Generate order ID and expiration time
    const orderId = generateOrderId()
    const expiresAt = calculateExpirationTime(9) // 9 minutes

    // Create order
    const orderData = {
      orderId,
      amount: validatedData.amount,
      description: validatedData.description,
      customerName: validatedData.customerName,
      customerEmail: validatedData.customerEmail,
      customerPhone: validatedData.customerPhone,
      upiId: validatedData.upiId || process.env.UPI_ID || 'merchant@paytm',
      status: 'pending' as const,
      createdBy: 'system', // You can replace with actual user ID
      expiresAt,
    }

    console.error('Creating order with data:', JSON.stringify(orderData, null, 2))
    
    const order = await OrderModel.create(orderData)

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
      message: 'Order created successfully',
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

    console.error('[Orders API] Order creation error:', error)
    
    // Enhanced error logging for MongoDB validation errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 121) {
      const mongoError = error as { code: number; errInfo?: unknown; errorResponse?: unknown }
      console.error('[Orders API] MongoDB Validation Error Details:', {
        code: mongoError.code,
        errInfo: mongoError.errInfo,
        errorResponse: mongoError.errorResponse,
      })
      
      return NextResponse.json(
        {
          error: 'Document validation failed',
          details: 'The order data does not meet the required schema constraints',
          mongoError: mongoError.errInfo || mongoError.errorResponse,
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      {
        error: 'Failed to create order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const status = searchParams.get('status')

    await connectDB()

    const query = status ? { status } : {}
    
    const orders = await OrderModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('orderId amount description status createdAt expiresAt utrNumber')

    return NextResponse.json({
      success: true,
      data: orders.map(order => ({
        orderId: order.orderId,
        amount: order.amount,
        description: order.description,
        status: order.status,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        utrNumber: order.utrNumber,
        paymentUrl: `/pay/${order.orderId}`,
        isExpired: order.expiresAt && new Date() > order.expiresAt,
      })),
      count: orders.length,
    })

  } catch (error) {
    console.error('[Orders API] Get orders error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}