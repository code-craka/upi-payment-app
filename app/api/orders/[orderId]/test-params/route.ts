import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    // Test 1: Can we access context?
    console.error('TEST: context available:', !!context)
    
    // Test 2: Can we access params?
    console.error('TEST: context.params available:', !!context.params)
    
    // Test 3: Can we await params?
    const params = await context.params
    console.error('TEST: params after await:', params)
    
    // Test 4: Can we extract orderId?
    const { orderId } = params
    console.error('TEST: orderId extracted:', orderId, typeof orderId)
    
    return NextResponse.json({
      success: true,
      orderId,
      type: typeof orderId
    })

  } catch (error) {
    console.error('TEST: Error occurred:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
    })
    
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}