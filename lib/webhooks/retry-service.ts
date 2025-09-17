import { redis } from '@/lib/redis';
import { RedisCircuitBreaker } from '@/lib/redis/circuit-breaker';
import { WebhookEvent } from '@clerk/nextjs/server';
import { deadLetterQueue } from './dead-letter-queue';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // Base delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  backoffMultiplier: number; // Exponential backoff multiplier
  jitter: boolean; // Add random jitter to prevent thundering herd
}

export interface RetryEntry {
  id: string;
  event: WebhookEvent;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number;
  lastRetryAt?: number;
  lastError?: string;
  correlationId: string;
  createdAt: number;
  processingTime?: number;
}

export interface RetryStats {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  averageRetryDelay: number;
  retryDistribution: Record<number, number>;
  currentBacklog: number;
}

export class RetryService {
  private static instance: RetryService;
  private circuitBreaker: RedisCircuitBreaker;
  private readonly RETRY_QUEUE_KEY = 'webhook:retry:queue';
  private readonly RETRY_STATS_KEY = 'webhook:retry:stats';
  private readonly PROCESSING_SET_KEY = 'webhook:retry:processing';
  private readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 300000, // 5 minutes
    backoffMultiplier: 2,
    jitter: true,
  };

  private constructor() {
    this.circuitBreaker = new RedisCircuitBreaker();
  }

  static getInstance(): RetryService {
    if (!RetryService.instance) {
      RetryService.instance = new RetryService();
    }
    return RetryService.instance;
  }

  /**
   * Schedule a webhook for retry
   */
  async scheduleRetry(
    event: WebhookEvent,
    error: Error,
    correlationId: string,
    config: Partial<RetryConfig> = {},
    processingTime?: number
  ): Promise<string> {
    const retryConfig = { ...this.DEFAULT_CONFIG, ...config };
    const retryId = crypto.randomUUID();

    const retryEntry: RetryEntry = {
      id: retryId,
      event,
      retryCount: 0,
      maxRetries: retryConfig.maxRetries,
      nextRetryAt: this.calculateNextRetryTime(0, retryConfig),
      correlationId,
      createdAt: Date.now(),
      processingTime,
    };

    try {
      await this.circuitBreaker.execute(async () => {
        // Add to retry queue with score as next retry time
        await redis.zadd(this.RETRY_QUEUE_KEY, {
          score: retryEntry.nextRetryAt,
          member: JSON.stringify(retryEntry),
        });

        // Update retry statistics
        await this.updateRetryStats('scheduled', retryEntry);

        console.log(`Scheduled webhook for retry: ${retryId}`, {
          correlationId,
          eventType: event.type,
          nextRetryAt: new Date(retryEntry.nextRetryAt).toISOString(),
          maxRetries: retryConfig.maxRetries,
        });
      });

      return retryId;
    } catch (circuitError) {
      console.error('Failed to schedule retry due to circuit breaker:', circuitError);
      throw new Error(`Retry scheduling failed: ${circuitError instanceof Error ? circuitError.message : 'Unknown error'}`);
    }
  }

  /**
   * Process pending retries
   */
  async processPendingRetries(
    processor: (event: WebhookEvent, correlationId: string) => Promise<boolean>
  ): Promise<{ processed: number; successful: number; failed: number }> {
    let processed = 0;
    let successful = 0;
    let failed = 0;

    try {
      return await this.circuitBreaker.execute(async () => {
        const now = Date.now();

        // Get entries ready for retry (score <= now)
        const retryEntries = await redis.zrange(
          this.RETRY_QUEUE_KEY,
          0,
          -1
        );

        // Filter entries that are ready for retry
        const readyEntries = (retryEntries as string[]).filter((entryStr: string) => {
          const entry = JSON.parse(entryStr) as RetryEntry;
          return entry.nextRetryAt <= now;
        }).slice(0, 10); // Process up to 10 at a time

        for (const entryStr of readyEntries) {
          const entry = JSON.parse(entryStr) as RetryEntry;
          processed++;

          // Check if already being processed
          const isProcessing = await redis.sismember(this.PROCESSING_SET_KEY, entry.id);
          if (isProcessing) {
            continue; // Skip if already being processed
          }

          // Mark as processing
          await redis.sadd(this.PROCESSING_SET_KEY, entry.id);
          await redis.expire(this.PROCESSING_SET_KEY, 300); // 5 minute TTL

          try {
            // Attempt to process the webhook
            const success = await processor(entry.event, entry.correlationId);

            if (success) {
              // Success - remove from retry queue
              await redis.zrem(this.RETRY_QUEUE_KEY, entryStr);
              await redis.srem(this.PROCESSING_SET_KEY, entry.id);
              await this.updateRetryStats('successful', entry);
              successful++;

              console.log(`Retry successful for webhook: ${entry.id}`, {
                correlationId: entry.correlationId,
                eventType: entry.event.type,
                retryCount: entry.retryCount,
              });
            } else {
              // Failed - schedule next retry or move to DLQ
              await this.handleRetryFailure(entry, entryStr);
              failed++;
            }
          } catch (error) {
            // Processing error - schedule next retry or move to DLQ
            await this.handleRetryFailure(entry, entryStr, error as Error);
            failed++;
          } finally {
            // Clean up processing marker
            await redis.srem(this.PROCESSING_SET_KEY, entry.id);
          }
        }

        return { processed, successful, failed };
      });
    } catch (error) {
      console.error('Failed to process pending retries:', error);
      return { processed, successful, failed };
    }
  }

  /**
   * Get retry entries for a specific webhook
   */
  async getRetryEntries(limit: number = 50): Promise<RetryEntry[]> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const entries = await redis.zrange(this.RETRY_QUEUE_KEY, 0, limit - 1);
        return (entries as string[]).map((entry: string) => JSON.parse(entry) as RetryEntry);
      });
    } catch (error) {
      console.error('Failed to get retry entries:', error);
      return [];
    }
  }

  /**
   * Get retry statistics
   */
  async getRetryStats(): Promise<RetryStats> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const stats = await redis.get(this.RETRY_STATS_KEY);
        if (stats) {
          return JSON.parse(stats as string);
        }

        // Calculate stats from current entries
        return await this.calculateRetryStats();
      });
    } catch (error) {
      console.error('Failed to get retry stats:', error);
      return {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        averageRetryDelay: 0,
        retryDistribution: {},
        currentBacklog: 0,
      };
    }
  }

  /**
   * Remove a retry entry (admin operation)
   */
  async removeRetryEntry(retryId: string): Promise<boolean> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const entries = await redis.zrange(this.RETRY_QUEUE_KEY, 0, -1);

        for (const entryStr of entries as string[]) {
          const entry = JSON.parse(entryStr) as RetryEntry;
          if (entry.id === retryId) {
            await redis.zrem(this.RETRY_QUEUE_KEY, entryStr);
            await this.updateRetryStats('removed', entry);
            console.log(`Removed retry entry: ${retryId}`);
            return true;
          }
        }

        return false;
      });
    } catch (error) {
      console.error('Failed to remove retry entry:', error);
      return false;
    }
  }

  /**
   * Clear all retry entries (admin operation)
   */
  async clearRetryQueue(): Promise<number> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const count = await redis.zcard(this.RETRY_QUEUE_KEY);
        await redis.del(this.RETRY_QUEUE_KEY);
        await redis.del(this.RETRY_STATS_KEY);
        await redis.del(this.PROCESSING_SET_KEY);

        console.log(`Cleared ${count} entries from retry queue`);
        return count;
      });
    } catch (error) {
      console.error('Failed to clear retry queue:', error);
      return 0;
    }
  }

  /**
   * Get entries ready for retry
   */
  async getReadyRetries(): Promise<RetryEntry[]> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const now = Date.now();
        const entries = await redis.zrange(this.RETRY_QUEUE_KEY, 0, -1);
        const readyEntries = (entries as string[]).filter((entryStr: string) => {
          const entry = JSON.parse(entryStr) as RetryEntry;
          return entry.nextRetryAt <= now;
        });
        return readyEntries.map((entryStr: string) => JSON.parse(entryStr) as RetryEntry);
      });
    } catch (error) {
      console.error('Failed to get ready retries:', error);
      return [];
    }
  }

  private calculateNextRetryTime(retryCount: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ retryCount)
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, retryCount);

    // Cap at maxDelay
    delay = Math.min(delay, config.maxDelay);

    // Add jitter if enabled
    if (config.jitter) {
      // Add random jitter of ±25%
      const jitterRange = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }

    return Date.now() + Math.floor(delay);
  }

  private async handleRetryFailure(
    entry: RetryEntry,
    entryStr: string,
    error?: Error
  ): Promise<void> {
    entry.retryCount++;
    entry.lastRetryAt = Date.now();
    entry.lastError = error?.message;

    if (entry.retryCount >= entry.maxRetries) {
      // Max retries reached - move to DLQ
      await redis.zrem(this.RETRY_QUEUE_KEY, entryStr);

      await deadLetterQueue.addToDLQ(
        entry.event,
        new Error(`Max retries (${entry.maxRetries}) exceeded. Last error: ${entry.lastError || 'Unknown'}`),
        entry.correlationId,
        {}, // headers not available in retry context
        entry.processingTime
      );

      await this.updateRetryStats('max_retries_exceeded', entry);

      console.error(`Max retries exceeded for webhook: ${entry.id}`, {
        correlationId: entry.correlationId,
        eventType: entry.event.type,
        retryCount: entry.retryCount,
        lastError: entry.lastError,
      });
    } else {
      // Schedule next retry
      entry.nextRetryAt = this.calculateNextRetryTime(entry.retryCount, this.DEFAULT_CONFIG);

      // Update the entry in the queue
      await redis.zrem(this.RETRY_QUEUE_KEY, entryStr);
      await redis.zadd(this.RETRY_QUEUE_KEY, {
        score: entry.nextRetryAt,
        member: JSON.stringify(entry),
      });

      await this.updateRetryStats('rescheduled', entry);

      console.log(`Rescheduled retry for webhook: ${entry.id}`, {
        correlationId: entry.correlationId,
        eventType: entry.event.type,
        retryCount: entry.retryCount,
        nextRetryAt: new Date(entry.nextRetryAt).toISOString(),
      });
    }
  }

  private async updateRetryStats(action: string, entry: RetryEntry): Promise<void> {
    const stats = await this.calculateRetryStats();

    switch (action) {
      case 'scheduled':
        stats.totalRetries++;
        stats.currentBacklog++;
        break;
      case 'successful':
        stats.successfulRetries++;
        stats.currentBacklog--;
        break;
      case 'max_retries_exceeded':
        stats.failedRetries++;
        stats.currentBacklog--;
        break;
      case 'removed':
        stats.currentBacklog--;
        break;
    }

    // Update retry distribution
    stats.retryDistribution[entry.retryCount] = (stats.retryDistribution[entry.retryCount] || 0) + 1;

    await redis.setex(this.RETRY_STATS_KEY, 3600, JSON.stringify(stats)); // Cache for 1 hour
  }

  private async calculateRetryStats(): Promise<RetryStats> {
    const entries = await redis.zrange(this.RETRY_QUEUE_KEY, 0, -1);
    const parsedEntries = (entries as string[]).map((entry: string) => JSON.parse(entry) as RetryEntry);

    const retryDistribution: Record<number, number> = {};
    let totalDelay = 0;
    let delayCount = 0;

    for (const entry of parsedEntries) {
      // Count by retry attempts
      retryDistribution[entry.retryCount] = (retryDistribution[entry.retryCount] || 0) + 1;

      // Calculate average delay
      if (entry.lastRetryAt && entry.createdAt) {
        const delay = entry.lastRetryAt - entry.createdAt;
        totalDelay += delay;
        delayCount++;
      }
    }

    // Get cached stats if available
    let cachedStats: Partial<RetryStats> = {};
    try {
      const cached = await redis.get(this.RETRY_STATS_KEY);
      if (cached) {
        cachedStats = JSON.parse(cached as string);
      }
    } catch (error) {
      // Ignore cache errors
    }

    return {
      totalRetries: cachedStats.totalRetries || 0,
      successfulRetries: cachedStats.successfulRetries || 0,
      failedRetries: cachedStats.failedRetries || 0,
      averageRetryDelay: delayCount > 0 ? totalDelay / delayCount : 0,
      retryDistribution,
      currentBacklog: parsedEntries.length,
    };
  }
}

// Export singleton instance
export const retryService = RetryService.getInstance();