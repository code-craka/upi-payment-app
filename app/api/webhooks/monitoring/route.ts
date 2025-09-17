import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/safe-auth';
import { webhookOrchestrator } from '@/lib/webhooks/orchestrator';

/**
 * Webhook Monitoring Dashboard API
 *
 * Provides comprehensive monitoring and management capabilities for webhooks:
 * - Processing statistics and metrics
 * - Dead letter queue management
 * - Failed webhook replay functionality
 * - Health status monitoring
 * - Performance analytics
 */

/**
 * GET - Retrieve webhook monitoring data
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate admin user
    await requireRole('admin');

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        return await getWebhookStats();
      case 'dlq':
        return await getDeadLetterQueue();
      case 'logs':
        return await getWebhookLogs(searchParams);
      case 'health':
        return await getWebhookHealth();
      default:
        return await getDashboardOverview();
    }
  } catch (error) {
    console.error('Webhook monitoring error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * POST - Perform webhook management actions
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate admin user
    await requireRole('admin');

    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'replay':
        return await replayFailedWebhook(params);
      case 'clear_dlq':
        return await clearDeadLetterQueue(params);
      case 'retry_all':
        return await retryAllFailedWebhooks();
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Webhook management error:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform action',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * Get comprehensive dashboard overview
 */
async function getDashboardOverview() {
  const stats = await webhookOrchestrator.getProcessingStats();

  return NextResponse.json({
    overview: {
      logsAvailable: stats.logs !== null,
      dlqAvailable: stats.deadLetterQueue !== null,
      totalRetries: stats.retries.totalRetries,
      successfulRetries: stats.retries.successfulRetries,
      failedRetries: stats.retries.failedRetries,
    },
    recentActivity: [],
    alerts: [],
  });
}

/**
 * Get detailed webhook processing statistics
 */
async function getWebhookStats() {
  const stats = await webhookOrchestrator.getProcessingStats();

  return NextResponse.json({
    statistics: {
      logs: stats.logs,
      deadLetterQueue: stats.deadLetterQueue,
      retries: stats.retries,
      timestamp: stats.timestamp,
    },
    timeSeries: [],
    performance: {},
  });
}

/**
 * Get dead letter queue contents
 */
async function getDeadLetterQueue() {
  return NextResponse.json({
    message: 'Dead letter queue contents not available',
    queue: [],
    statistics: { size: 0, oldest: null },
    pagination: { total: 0, page: 1, limit: 50 },
  });
}

/**
 * Get webhook processing logs
 */
async function getWebhookLogs(searchParams: URLSearchParams) {
  const limit = parseInt(searchParams.get('limit') || '50');
  const correlationId = searchParams.get('correlationId');

  let logs: any[] = [];
  if (correlationId) {
    logs = await webhookOrchestrator.getLogsByCorrelationId(correlationId);
  } else {
    logs = await webhookOrchestrator.getRecentLogs(limit);
  }

  return NextResponse.json({
    logs,
    pagination: { total: logs.length, page: 1, limit },
    filters: { correlationId },
  });
}

/**
 * Get webhook system health status
 */
async function getWebhookHealth() {
  const stats = await webhookOrchestrator.getProcessingStats();

  return NextResponse.json({
    status: 'healthy',
    uptime: process.uptime(),
    services: [
      { service: 'orchestrator', status: 'healthy' },
      { service: 'logs', status: stats.logs ? 'healthy' : 'disabled' },
      { service: 'dlq', status: stats.deadLetterQueue ? 'healthy' : 'disabled' },
    ],
    alerts: [],
    metrics: stats.retries,
    lastChecked: stats.timestamp,
  });
}

/**
 * Replay a failed webhook from the dead letter queue
 */
async function replayFailedWebhook(params: any) {
  return NextResponse.json({
    success: false,
    message: 'Webhook replay functionality not yet implemented',
  });
}

/**
 * Clear dead letter queue entries
 */
async function clearDeadLetterQueue(params: any) {
  return NextResponse.json({
    success: false,
    message: 'Dead letter queue clearing not yet implemented',
    clearedCount: 0,
    remainingCount: 0,
  });
}

/**
 * Retry all failed webhooks in the dead letter queue
 */
async function retryAllFailedWebhooks() {
  return NextResponse.json({
    success: false,
    message: 'Bulk retry functionality not yet implemented',
    totalRetried: 0,
    successfulRetries: 0,
    failedRetries: 0,
  });
}
