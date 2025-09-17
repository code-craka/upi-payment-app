import { NextRequest, NextResponse } from 'next/server';
import { webhookOrchestrator } from '@/lib/webhooks/orchestrator';
import { WebhookEvent } from '@clerk/nextjs/server';

/**
 * Clerk Webhook Handler with Enhanced Security
 *
 * This API route handles incoming webhooks from Clerk with comprehensive
 * security, idempotency, retry logic, and monitoring using our webhook orchestrator.
 *
 * Features:
 * - Signature verification using svix
 * - Idempotency to prevent duplicate processing
 * - Automatic retry with exponential backoff
 * - Dead letter queue for failed webhooks
 * - Comprehensive logging and monitoring
 * - Correlation ID tracking
 * - Timeout handling
 * - Circuit breaker protection
 */
export async function POST(request: NextRequest) {
  try {
    // Process webhook with full orchestration
    const result = await webhookOrchestrator.processWebhook(
      request,
      async (event: WebhookEvent, correlationId: string): Promise<boolean> => {
        // Webhook processing logic
        console.log(`Processing Clerk webhook: ${event.type}`, {
          correlationId,
          eventId: (event as any).id,
          userId: extractUserId(event),
        });

        // Handle different webhook event types
        switch (event.type) {
          case 'user.created':
            await handleUserCreated(event, correlationId);
            break;

          case 'user.updated':
            await handleUserUpdated(event, correlationId);
            break;

          case 'user.deleted':
            await handleUserDeleted(event, correlationId);
            break;

          case 'session.created':
            await handleSessionCreated(event, correlationId);
            break;

          case 'session.removed':
            await handleSessionRemoved(event, correlationId);
            break;

          case 'session.revoked':
            await handleSessionRevoked(event, correlationId);
            break;

          default:
            console.log(`Unhandled webhook event type: ${event.type}`, { correlationId });
        }

        // Simulate processing time and potential failures
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));

        // Return success (90% success rate for testing)
        return Math.random() > 0.1;
      },
    );

    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          correlationId: result.correlationId,
          processingTime: result.processingTime,
          message: 'Webhook processed successfully',
        },
        { status: 200 },
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          correlationId: result.correlationId,
          processingTime: result.processingTime,
          error: result.error,
          message: 'Webhook processing failed',
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Webhook processing error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Webhook processing failed',
      },
      { status: 500 },
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    const stats = await webhookOrchestrator.getProcessingStats();

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        stats,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Webhook status check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

/**
 * Handle user.created webhook events
 */
async function handleUserCreated(event: WebhookEvent, correlationId: string): Promise<void> {
  const userData = event.data as any;

  console.log('Handling user created event', {
    correlationId,
    userId: userData.id,
    email: userData.email_addresses?.[0]?.email_address,
    createdAt: userData.created_at,
  });

  // TODO: Implement user creation logic
  // - Create user record in database
  // - Send welcome email
  // - Set up default preferences
  // - Update user statistics
}

/**
 * Handle user.updated webhook events
 */
async function handleUserUpdated(event: WebhookEvent, correlationId: string): Promise<void> {
  const userData = event.data as any;

  console.log('Handling user updated event', {
    correlationId,
    userId: userData.id,
    updatedFields: Object.keys(userData),
  });

  // TODO: Implement user update logic
  // - Update user record in database
  // - Handle email changes
  // - Update user preferences
  // - Sync with external systems
}

/**
 * Handle user.deleted webhook events
 */
async function handleUserDeleted(event: WebhookEvent, correlationId: string): Promise<void> {
  const userData = event.data as any;

  console.log('Handling user deleted event', {
    correlationId,
    userId: userData.id,
    deletedAt: userData.deleted_at,
  });

  // TODO: Implement user deletion logic
  // - Mark user as deleted in database
  // - Clean up user data (GDPR compliance)
  // - Cancel subscriptions
  // - Notify administrators
}

/**
 * Handle session.created webhook events
 */
async function handleSessionCreated(event: WebhookEvent, correlationId: string): Promise<void> {
  const sessionData = event.data as any;

  console.log('Handling session created event', {
    correlationId,
    sessionId: sessionData.id,
    userId: sessionData.user_id,
    createdAt: sessionData.created_at,
  });

  // TODO: Implement session creation logic
  // - Log user login
  // - Update last login timestamp
  // - Send security notifications if needed
}

/**
 * Handle session.removed webhook events
 */
async function handleSessionRemoved(event: WebhookEvent, correlationId: string): Promise<void> {
  const sessionData = event.data as any;

  console.log('Handling session removed event', {
    correlationId,
    sessionId: sessionData.id,
    userId: sessionData.user_id,
    removedAt: new Date().toISOString(),
  });

  // TODO: Implement session removal logic
  // - Log user logout
  // - Clean up session data
  // - Update user status
}

/**
 * Handle session.revoked webhook events
 */
async function handleSessionRevoked(event: WebhookEvent, correlationId: string): Promise<void> {
  const sessionData = event.data as any;

  console.log('Handling session revoked event', {
    correlationId,
    sessionId: sessionData.id,
    userId: sessionData.user_id,
    revokedAt: new Date().toISOString(),
  });

  // TODO: Implement session revocation logic
  // - Log security event
  // - Send security alert
  // - Force logout on all devices
  // - Review recent activity
}

/**
 * Extract user ID from webhook event
 */
function extractUserId(event: WebhookEvent): string | undefined {
  switch (event.type) {
    case 'user.created':
    case 'user.updated':
    case 'user.deleted':
      return (event.data as any).id;
    case 'session.created':
    case 'session.removed':
    case 'session.revoked':
      return (event.data as any).user_id;
    default:
      return undefined;
  }
}
