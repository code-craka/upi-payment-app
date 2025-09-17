import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db/connection'
import { OrderModel } from '@/lib/db/models/Order'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    await connectDB()

    const { orderId } = await context.params
    console.error('Debug: orderId received:', orderId, typeof orderId)

    const order = await OrderModel.findOne({ orderId: String(orderId) })
    console.error('Debug: order found:', !!order)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      order: {
        orderId: order.orderId,
        amount: order.amount,
        status: order.status,
        description: order.description,
      }
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    await connectDB()

    const { orderId } = await context.params
    const body = await request.json()
    
    console.error('Debug POST: orderId:', orderId)
    console.error('Debug POST: body:', body)

    return NextResponse.json({
      success: true,
      received: { orderId, body }
    })

  } catch (error) {
    console.error('Debug POST error:', error)
    return NextResponse.json({
      error: 'Debug POST failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}