import { WebhookEvent } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { WebhookSecurityService } from './security';
import { retryService } from './retry-service';
import { deadLetterQueue } from './dead-letter-queue';
import { webhookLogger } from './logging-service';
import { getWebhookIdempotencyService } from './idempotency';
import { redis } from '@/lib/redis';

export interface WebhookProcessingResult {
  success: boolean;
  correlationId: string;
  processingTime: number;
  retryCount?: number;
  error?: string;
  eventType: string;
  userId?: string;
}

export interface WebhookOrchestratorConfig {
  maxRetries?: number;
  retryBaseDelay?: number;
  enableDLQ?: boolean;
  enableLogging?: boolean;
  timeoutMs?: number;
}

export class WebhookOrchestratorService {
  private static instance: WebhookOrchestratorService;
  private config: Required<WebhookOrchestratorConfig>;
  private webhookSecurity: WebhookSecurityService;
  private idempotencyService: any; // Will be properly typed later

  private constructor(config: WebhookOrchestratorConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryBaseDelay: config.retryBaseDelay ?? 1000,
      enableDLQ: config.enableDLQ ?? true,
      enableLogging: config.enableLogging ?? true,
      timeoutMs: config.timeoutMs ?? 30000, // 30 seconds
    };
    this.webhookSecurity = new WebhookSecurityService();
    this.idempotencyService = getWebhookIdempotencyService(redis);
  }

  static getInstance(config?: WebhookOrchestratorConfig): WebhookOrchestratorService {
    if (!WebhookOrchestratorService.instance) {
      WebhookOrchestratorService.instance = new WebhookOrchestratorService(config);
    }
    return WebhookOrchestratorService.instance;
  }

  /**
   * Process a webhook with full orchestration
   */
  async processWebhook(
    request: NextRequest,
    processor: (event: WebhookEvent, correlationId: string) => Promise<boolean>,
  ): Promise<WebhookProcessingResult> {
    const startTime = performance.now();
    const correlationId = crypto.randomUUID();

    let event: WebhookEvent | null = null;
    let userId: string | undefined;

    try {
      // Step 1: Verify webhook signature and extract event
      if (this.config.enableLogging) {
        await webhookLogger.log('info', 'webhook_received', 'Webhook received for processing', {
          correlationId,
          source: 'orchestrator',
          ipAddress: request.headers.get('x-forwarded-for') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        });
      }

      const verificationResult = await this.webhookSecurity.verifyWebhook(request, {
        correlationId,
      });

      if (!verificationResult.success) {
        const error = `Webhook verification failed: ${verificationResult.error?.message || 'Unknown error'}`;
        if (this.config.enableLogging) {
          await webhookLogger.log('error', 'webhook_verification_failed', error, {
            correlationId,
            source: 'orchestrator',
            metadata: { verificationResult },
          });
        }
        throw new Error(error);
      }

      event = verificationResult.event!;
      if (!event) {
        throw new Error('Event extraction failed');
      }

      userId = this.extractUserId(event);

      if (this.config.enableLogging) {
        await webhookLogger.log(
          'info',
          'webhook_verified',
          'Webhook signature verified successfully',
          {
            correlationId,
            userId,
            source: 'orchestrator',
            metadata: { eventType: event.type },
          },
        );
      }

      // Step 2: Check for duplicate processing (idempotency) - TODO: Implement later
      // const isDuplicate = await this.idempotencyService.checkIdempotency(event.id, event.type, correlationId);
      // if (isDuplicate) { ... }

      // Step 3: Process the webhook with timeout
      const processingPromise = this.processWithTimeout(processor, event, correlationId);
      const success = await processingPromise;

      const processingTime = performance.now() - startTime;

      if (success) {
        // Mark as processed for idempotency - TODO: Implement later
        // await this.idempotencyService.markCompleted(event.id);

        if (this.config.enableLogging) {
          await webhookLogger.log('info', 'webhook_processed', 'Webhook processed successfully', {
            correlationId,
            userId,
            source: 'orchestrator',
            duration: processingTime,
            metadata: { processingTime, eventType: event.type },
          });
        }

        return {
          success: true,
          correlationId,
          processingTime,
          eventType: event.type,
          userId,
        };
      } else {
        throw new Error('Webhook processing returned false');
      }
    } catch (error) {
      const processingTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (this.config.enableLogging) {
        await webhookLogger.log(
          'error',
          'webhook_processing_failed',
          `Webhook processing failed: ${errorMessage}`,
          {
            correlationId,
            userId,
            source: 'orchestrator',
            duration: processingTime,
            error: error instanceof Error ? error : new Error(errorMessage),
            metadata: { processingTime, eventType: event?.type },
          },
        );
      }

      // Step 4: Handle failure - either retry or move to DLQ
      if (this.config.enableDLQ) {
        try {
          await deadLetterQueue.addToDLQ(
            event!,
            error instanceof Error ? error : new Error(errorMessage),
            correlationId,
            this.extractHeaders(request),
            processingTime,
          );

          if (this.config.enableLogging) {
            await webhookLogger.log(
              'info',
              'webhook_moved_to_dlq',
              'Webhook moved to dead letter queue',
              {
                correlationId,
                userId,
                source: 'orchestrator',
                metadata: { eventType: event?.type },
              },
            );
          }
        } catch (dlqError) {
          if (this.config.enableLogging) {
            await webhookLogger.log(
              'error',
              'dlq_failure',
              'Failed to add webhook to dead letter queue',
              {
                correlationId,
                userId,
                source: 'orchestrator',
                error: dlqError instanceof Error ? dlqError : new Error('DLQ error'),
                metadata: { eventType: event?.type },
              },
            );
          }
        }
      }

      return {
        success: false,
        correlationId,
        processingTime,
        eventType: event?.type || 'unknown',
        userId,
        error: errorMessage,
      };
    }
  }

  /**
   * Process pending retries
   */
  async processPendingRetries(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    if (!this.config.enableLogging) {
      return { processed: 0, successful: 0, failed: 0 };
    }

    const startTime = performance.now();

    const result = await retryService.processPendingRetries(async (event, correlationId) => {
      // Re-process the webhook
      const mockRequest = this.createMockRequest(event);
      const processor = this.createDefaultProcessor();

      const processingResult = await this.processWebhook(mockRequest, processor);
      return processingResult.success;
    });

    const processingTime = performance.now() - startTime;

    await webhookLogger.log(
      'info',
      'retry_processing_completed',
      'Completed processing pending retries',
      {
        source: 'orchestrator',
        duration: processingTime,
        metadata: result,
      },
    );

    return result;
  }

  /**
   * Get webhook processing statistics
   */
  async getProcessingStats() {
    const [logStats, dlqStats, retryStats] = await Promise.all([
      this.config.enableLogging ? webhookLogger.getLogStats() : null,
      this.config.enableDLQ ? deadLetterQueue.getDLQStats() : null,
      retryService.getRetryStats(),
    ]);

    return {
      logs: logStats,
      deadLetterQueue: dlqStats,
      retries: retryStats,
      timestamp: Date.now(),
    };
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(): Promise<{
    logsCleaned: number;
    dlqCleaned: number;
  }> {
    const [logsCleaned, dlqCleaned] = await Promise.all([
      this.config.enableLogging ? webhookLogger.cleanupOldLogs() : Promise.resolve(0),
      this.config.enableDLQ ? deadLetterQueue.cleanupOldEntries() : Promise.resolve(0),
    ]);

    if (this.config.enableLogging) {
      await webhookLogger.log(
        'info',
        'cleanup_completed',
        'Completed cleanup of old webhook data',
        {
          source: 'orchestrator',
          metadata: { logsCleaned, dlqCleaned },
        },
      );
    }

    return { logsCleaned, dlqCleaned };
  }

  /**
   * Get logs for a specific correlation ID
   */
  async getLogsByCorrelationId(correlationId: string) {
    if (!this.config.enableLogging) {
      return [];
    }
    return webhookLogger.getLogsByCorrelationId(correlationId);
  }

  /**
   * Get error logs
   */
  async getErrorLogs(limit: number = 50) {
    if (!this.config.enableLogging) {
      return [];
    }
    return webhookLogger.getErrorLogs(limit);
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(limit: number = 50) {
    if (!this.config.enableLogging) {
      return [];
    }
    return webhookLogger.getRecentLogs(limit);
  }

  private async processWithTimeout(
    processor: (event: WebhookEvent, correlationId: string) => Promise<boolean>,
    event: WebhookEvent,
    correlationId: string,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Webhook processing timeout after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);

      processor(event, correlationId)
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private extractUserId(event: WebhookEvent): string | undefined {
    // Extract user ID from different event types
    switch (event.type) {
      case 'user.created':
      case 'user.updated':
      case 'user.deleted':
        return event.data.id;
      case 'session.created':
      case 'session.removed':
      case 'session.revoked':
        return event.data.user_id;
      default:
        return undefined;
    }
  }

  private extractHeaders(request: NextRequest): Record<string, string> {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  private createMockRequest(event: WebhookEvent): NextRequest {
    // Create a minimal mock request for retry processing
    // In a real implementation, you'd want to store the original request data
    const mockHeaders = new Headers({
      'content-type': 'application/json',
      'x-clerk-signature': 'mock-signature',
    });

    return new NextRequest('http://localhost:3000/api/webhooks/clerk', {
      method: 'POST',
      headers: mockHeaders,
      body: JSON.stringify(event),
    });
  }

  /**
   * Get dead letter queue statistics
   */
  async getDeadLetterQueueStats() {
    if (!this.config.enableDLQ) {
      return null;
    }
    return deadLetterQueue.getDLQStats();
  }

  /**
   * Get health status of all webhook services
   */
  async getHealthStatus() {
    const services = await Promise.allSettled([
      this.webhookSecurity.getHealthStatus(),
      this.idempotencyService.getHealthStatus(),
      this.config.enableDLQ
        ? deadLetterQueue.getHealthStatus()
        : Promise.resolve({ status: 'disabled' }),
      retryService.getHealthStatus(),
      this.config.enableLogging
        ? webhookLogger.getHealthStatus()
        : Promise.resolve({ status: 'disabled' }),
    ]);

    const serviceStatuses = services.map((result, index) => ({
      service: ['security', 'idempotency', 'dlq', 'retry', 'logging'][index],
      status: result.status === 'fulfilled' ? result.value.status : 'error',
      details: result.status === 'fulfilled' ? result.value : result.reason,
    }));

    const overallStatus = serviceStatuses.every(
      (s) => s.status === 'healthy' || s.status === 'disabled',
    )
      ? 'healthy'
      : 'degraded';

    return {
      status: overallStatus,
      uptime: process.uptime(),
      services: serviceStatuses,
      alerts: serviceStatuses
        .filter((s) => s.status === 'error')
        .map((s) => ({
          service: s.service,
          message: `Service ${s.service} is unhealthy`,
          timestamp: Date.now(),
        })),
      lastChecked: Date.now(),
    };
  }

  /**
   * Get dead letter queue contents
   */
  async getDeadLetterQueueContents() {
    if (!this.config.enableDLQ) {
      return {
        items: [],
        stats: { size: 0, oldest: null },
        pagination: { total: 0, page: 1, limit: 50 },
      };
    }

    const [items, stats] = await Promise.all([
      deadLetterQueue.getDLQContents(1, 50),
      deadLetterQueue.getDLQStats(),
    ]);

    return {
      items,
      stats,
      pagination: { total: stats.size, page: 1, limit: 50 },
    };
  }

  /**
   * Get processing logs with filtering
   */
  async getProcessingLogs(options: {
    limit?: number;
    offset?: number;
    correlationId?: string;
    eventType?: string;
    status?: string;
  }) {
    if (!this.config.enableLogging) {
      return { items: [], pagination: { total: 0, page: 1, limit: options.limit || 50 } };
    }

    const logs = await webhookLogger.getFilteredLogs(options);
    const total = await webhookLogger.getLogCount(options);

    return {
      items: logs,
      pagination: {
        total,
        page: Math.floor((options.offset || 0) / (options.limit || 50)) + 1,
        limit: options.limit || 50,
      },
    };
  }

  /**
   * Replay a failed webhook from the dead letter queue
   */
  async replayFailedWebhook(options: { correlationId?: string; webhookId?: string }) {
    if (!this.config.enableDLQ) {
      return { success: false, message: 'Dead letter queue is disabled' };
    }

    try {
      const webhook = await deadLetterQueue.getWebhookById(
        options.correlationId || options.webhookId!,
      );
      if (!webhook) {
        return { success: false, message: 'Webhook not found in dead letter queue' };
      }

      // Create mock request and processor
      const mockRequest = this.createMockRequest(webhook.event);
      const processor = this.createDefaultProcessor();

      // Process the webhook
      const result = await this.processWebhook(mockRequest, processor);

      if (result.success) {
        // Remove from DLQ if successful
        await deadLetterQueue.removeFromDLQ(options.correlationId || options.webhookId!);
      }

      return {
        success: result.success,
        message: result.success ? 'Webhook replayed successfully' : 'Webhook replay failed',
        correlationId: result.correlationId,
        processingTime: result.processingTime,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to replay webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Clear dead letter queue entries
   */
  async clearDeadLetterQueue(options: { olderThan?: number; correlationIds?: string[] }) {
    if (!this.config.enableDLQ) {
      return {
        success: false,
        message: 'Dead letter queue is disabled',
        clearedCount: 0,
        remainingCount: 0,
      };
    }

    try {
      let clearedCount = 0;

      if (options.correlationIds) {
        // Clear specific correlation IDs
        for (const correlationId of options.correlationIds) {
          await deadLetterQueue.removeFromDLQ(correlationId);
          clearedCount++;
        }
      } else if (options.olderThan) {
        // Clear entries older than specified timestamp
        clearedCount = await deadLetterQueue.clearOldEntries(options.olderThan);
      } else {
        // Clear all entries
        clearedCount = await deadLetterQueue.clearAllEntries();
      }

      const remainingCount = await deadLetterQueue.getDLQSize();

      return {
        success: true,
        message: `Cleared ${clearedCount} entries from dead letter queue`,
        clearedCount,
        remainingCount,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to clear dead letter queue: ${error instanceof Error ? error.message : 'Unknown error'}`,
        clearedCount: 0,
        remainingCount: await deadLetterQueue.getDLQSize(),
      };
    }
  }

  /**
   * Retry all failed webhooks in the dead letter queue
   */
  async retryAllFailedWebhooks() {
    if (!this.config.enableDLQ) {
      return {
        success: false,
        message: 'Dead letter queue is disabled',
        totalRetried: 0,
        successfulRetries: 0,
        failedRetries: 0,
      };
    }

    try {
      const dlqContents = await deadLetterQueue.getDLQContents(1, 1000); // Get up to 1000 entries
      let successfulRetries = 0;
      let failedRetries = 0;

      for (const webhook of dlqContents) {
        try {
          const mockRequest = this.createMockRequest(webhook.event);
          const processor = this.createDefaultProcessor();

          const result = await this.processWebhook(mockRequest, processor);

          if (result.success) {
            await deadLetterQueue.removeFromDLQ(webhook.correlationId);
            successfulRetries++;
          } else {
            failedRetries++;
          }
        } catch (error) {
          failedRetries++;
          console.error(`Failed to retry webhook ${webhook.correlationId}:`, error);
        }
      }

      return {
        success: true,
        message: `Retried ${dlqContents.length} webhooks: ${successfulRetries} successful, ${failedRetries} failed`,
        totalRetried: dlqContents.length,
        successfulRetries,
        failedRetries,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retry webhooks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        totalRetried: 0,
        successfulRetries: 0,
        failedRetries: 0,
      };
    }
  }

  private createDefaultProcessor(): (
    event: WebhookEvent,
    correlationId: string,
  ) => Promise<boolean> {
    // Default processor that just logs the event
    // In a real implementation, this would be the actual webhook processing logic
    return async (event: WebhookEvent, correlationId: string): Promise<boolean> => {
      console.log(`Processing webhook event: ${event.type}`, { correlationId });

      // Simulate some processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Return true for success, false for failure
      return Math.random() > 0.1; // 90% success rate for testing
    };
  }
}

// Export singleton instance
export const webhookOrchestrator = WebhookOrchestratorService.getInstance();
