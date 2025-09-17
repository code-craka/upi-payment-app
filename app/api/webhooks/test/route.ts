import { NextRequest, NextResponse } from 'next/server';
import { webhookOrchestrator } from '@/lib/webhooks/orchestrator';

/**
 * Test endpoint for webhook security system
 *
 * This endpoint allows testing the webhook processing pipeline
 * with mock webhook events.
 */
export async function POST(request: NextRequest) {
  try {
    const { eventType, testFailure } = await request.json();

    // Create a mock webhook event
    const mockEvent = {
      type: eventType || 'user.created',
      data: {
        id: `test_${Date.now()}`,
        email_addresses: [{ email_address: 'test@example.com' }],
        first_name: 'Test',
        last_name: 'User',
        created_at: Date.now(),
      },
    };

    // Create a mock request with proper headers
    const mockHeaders = new Headers({
      'content-type': 'application/json',
      'x-clerk-signature': 'mock-signature-for-testing',
      'svix-id': `test_${Date.now()}`,
      'svix-timestamp': Date.now().toString(),
      'svix-signature': 'v1,test_signature',
    });

    const mockRequest = new NextRequest('http://localhost:3000/api/webhooks/test', {
      method: 'POST',
      headers: mockHeaders,
      body: JSON.stringify(mockEvent),
    });

    // Process the webhook
    const result = await webhookOrchestrator.processWebhook(
      mockRequest,
      async (event, correlationId): Promise<boolean> => {
        console.log(`Test processing webhook: ${event.type}`, { correlationId });

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));

        // Return success unless testFailure is true
        return !testFailure;
      }
    );

    return NextResponse.json({
      success: true,
      testResult: result,
      message: 'Webhook test completed',
    });

  } catch (error) {
    console.error('Webhook test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Webhook test failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve test statistics
 */
export async function GET() {
  try {
    const stats = await webhookOrchestrator.getProcessingStats();

    return NextResponse.json({
      status: 'test_endpoint_active',
      timestamp: new Date().toISOString(),
      stats,
      message: 'Webhook security system test endpoint',
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}