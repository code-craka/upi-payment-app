import { redis } from '@/lib/redis';
import { RedisCircuitBreaker } from '@/lib/redis/circuit-breaker';
import { WebhookEvent } from '@clerk/nextjs/server';

export interface DeadLetterEntry {
  id: string;
  event: WebhookEvent;
  error: string;
  timestamp: number;
  retryCount: number;
  correlationId: string;
  headers: Record<string, string>;
  processingTime?: number;
  lastRetryAt?: number;
  nextRetryAt?: number;
}

export interface DLQStats {
  totalEntries: number;
  entriesByType: Record<string, number>;
  oldestEntry: number;
  newestEntry: number;
  averageProcessingTime: number;
  retryDistribution: Record<number, number>;
}

export class DeadLetterQueueService {
  private static instance: DeadLetterQueueService;
  private circuitBreaker: RedisCircuitBreaker;
  private readonly DLQ_KEY = 'webhook:dlq';
  private readonly DLQ_STATS_KEY = 'webhook:dlq:stats';
  private readonly MAX_ENTRIES = 10000;
  private readonly ENTRY_TTL = 7 * 24 * 60 * 60; // 7 days

  private constructor() {
    this.circuitBreaker = new RedisCircuitBreaker();
  }

  static getInstance(): DeadLetterQueueService {
    if (!DeadLetterQueueService.instance) {
      DeadLetterQueueService.instance = new DeadLetterQueueService();
    }
    return DeadLetterQueueService.instance;
  }

  /**
   * Add a failed webhook to the dead letter queue
   */
  async addToDLQ(
    event: WebhookEvent,
    error: Error,
    correlationId: string,
    headers: Record<string, string>,
    processingTime?: number,
  ): Promise<string> {
    const entryId = crypto.randomUUID();
    const entry: DeadLetterEntry = {
      id: entryId,
      event,
      error: error.message,
      timestamp: Date.now(),
      retryCount: 0,
      correlationId,
      headers,
      processingTime,
      lastRetryAt: undefined,
      nextRetryAt: undefined,
    };

    try {
      await this.circuitBreaker.execute(async () => {
        // Add to DLQ list
        await redis.lpush(this.DLQ_KEY, JSON.stringify(entry));

        // Set TTL for the entry
        await redis.expire(this.DLQ_KEY, this.ENTRY_TTL);

        // Update statistics
        await this.updateDLQStats(entry);

        // Trim DLQ if it exceeds max entries
        await redis.ltrim(this.DLQ_KEY, 0, this.MAX_ENTRIES - 1);

        // Alert if DLQ is getting large
        const dlqSize = await redis.llen(this.DLQ_KEY);
        if (dlqSize > 100) {
          console.warn(`Dead Letter Queue size: ${dlqSize} entries`);
          // TODO: Send alert to monitoring system
        }
      });

      console.error(`Webhook added to DLQ: ${entryId}`, {
        correlationId,
        eventType: event.type,
        error: error.message,
      });

      return entryId;
    } catch (circuitError) {
      console.error('Failed to add to DLQ due to circuit breaker:', circuitError);
      // If Redis is down, we still want to log the failure
      throw new Error(
        `DLQ unavailable: ${circuitError instanceof Error ? circuitError.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Retrieve entries from the dead letter queue
   */
  async getDLQEntries(limit: number = 50, offset: number = 0): Promise<DeadLetterEntry[]> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const entries = await redis.lrange(this.DLQ_KEY, offset, offset + limit - 1);
        return entries.map((entry: string) => JSON.parse(entry) as DeadLetterEntry);
      });
    } catch (error) {
      console.error('Failed to retrieve DLQ entries:', error);
      return [];
    }
  }

  /**
   * Get a specific entry by ID
   */
  async getDLQEntry(entryId: string): Promise<DeadLetterEntry | null> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const entries = await redis.lrange(this.DLQ_KEY, 0, -1);
        const entry = entries
          .map((e: string) => JSON.parse(e) as DeadLetterEntry)
          .find((e: DeadLetterEntry) => e.id === entryId);
        return entry || null;
      });
    } catch (error) {
      console.error('Failed to retrieve DLQ entry:', error);
      return null;
    }
  }

  /**
   * Remove an entry from the DLQ (after successful retry)
   */
  async removeFromDLQ(entryId: string): Promise<boolean> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const entries = await redis.lrange(this.DLQ_KEY, 0, -1);
        const entryIndex = entries.findIndex((entry: string) => {
          const parsed = JSON.parse(entry) as DeadLetterEntry;
          return parsed.id === entryId;
        });

        if (entryIndex === -1) {
          return false;
        }

        // Remove the entry
        await redis.lrem(this.DLQ_KEY, 1, entries[entryIndex]);

        // Update stats
        await this.updateDLQStatsRemoval(JSON.parse(entries[entryIndex]) as DeadLetterEntry);

        console.log(`Removed entry from DLQ: ${entryId}`);
        return true;
      });
    } catch (error) {
      console.error('Failed to remove from DLQ:', error);
      return false;
    }
  }

  /**
   * Update retry information for an entry
   */
  async updateRetryInfo(
    entryId: string,
    retryCount: number,
    lastRetryAt: number,
    nextRetryAt?: number,
  ): Promise<boolean> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const entries = await redis.lrange(this.DLQ_KEY, 0, -1);
        const entryIndex = entries.findIndex((entry: string) => {
          const parsed = JSON.parse(entry) as DeadLetterEntry;
          return parsed.id === entryId;
        });

        if (entryIndex === -1) {
          return false;
        }

        const entry = JSON.parse(entries[entryIndex]) as DeadLetterEntry;
        entry.retryCount = retryCount;
        entry.lastRetryAt = lastRetryAt;
        entry.nextRetryAt = nextRetryAt;

        // Replace the entry
        await redis.lset(this.DLQ_KEY, entryIndex, JSON.stringify(entry));

        return true;
      });
    } catch (error) {
      console.error('Failed to update retry info:', error);
      return false;
    }
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(): Promise<DLQStats> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const stats = await redis.get(this.DLQ_STATS_KEY);
        if (stats) {
          return JSON.parse(stats as string);
        }

        // Calculate stats from current entries
        return await this.calculateDLQStats();
      });
    } catch (error) {
      console.error('Failed to get DLQ stats:', error);
      return {
        totalEntries: 0,
        entriesByType: {},
        oldestEntry: 0,
        newestEntry: 0,
        averageProcessingTime: 0,
        retryDistribution: {},
      };
    }
  }

  /**
   * Clean up old entries (entries older than TTL)
   */
  async cleanupOldEntries(): Promise<number> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const entries = await redis.lrange(this.DLQ_KEY, 0, -1);
        const cutoffTime = Date.now() - this.ENTRY_TTL * 1000;
        let removedCount = 0;

        for (const entryStr of entries) {
          const entry = JSON.parse(entryStr) as DeadLetterEntry;
          if (entry.timestamp < cutoffTime) {
            await redis.lrem(this.DLQ_KEY, 0, entryStr);
            removedCount++;
          }
        }

        if (removedCount > 0) {
          console.log(`Cleaned up ${removedCount} old DLQ entries`);
        }

        return removedCount;
      });
    } catch (error) {
      console.error('Failed to cleanup old DLQ entries:', error);
      return 0;
    }
  }

  /**
   * Clear all entries from DLQ (admin operation)
   */
  async clearDLQ(): Promise<number> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const count = await redis.llen(this.DLQ_KEY);
        await redis.del(this.DLQ_KEY);
        await redis.del(this.DLQ_STATS_KEY);

        console.log(`Cleared ${count} entries from DLQ`);
        return count;
      });
    } catch (error) {
      console.error('Failed to clear DLQ:', error);
      return 0;
    }
  }

  private async updateDLQStats(entry: DeadLetterEntry): Promise<void> {
    const stats = await this.calculateDLQStats();

    // Update type distribution
    stats.entriesByType[entry.event.type] = (stats.entriesByType[entry.event.type] || 0) + 1;

    // Update retry distribution
    stats.retryDistribution[entry.retryCount] =
      (stats.retryDistribution[entry.retryCount] || 0) + 1;

    // Update timestamps
    if (stats.totalEntries === 0) {
      stats.oldestEntry = entry.timestamp;
      stats.newestEntry = entry.timestamp;
    } else {
      stats.oldestEntry = Math.min(stats.oldestEntry, entry.timestamp);
      stats.newestEntry = Math.max(stats.newestEntry, entry.timestamp);
    }

    await redis.setex(this.DLQ_STATS_KEY, 3600, JSON.stringify(stats)); // Cache for 1 hour
  }

  private async updateDLQStatsRemoval(entry: DeadLetterEntry): Promise<void> {
    const stats = await this.calculateDLQStats();

    // Update type distribution
    if (stats.entriesByType[entry.event.type]) {
      stats.entriesByType[entry.event.type]--;
      if (stats.entriesByType[entry.event.type] === 0) {
        delete stats.entriesByType[entry.event.type];
      }
    }

    // Update retry distribution
    if (stats.retryDistribution[entry.retryCount]) {
      stats.retryDistribution[entry.retryCount]--;
      if (stats.retryDistribution[entry.retryCount] === 0) {
        delete stats.retryDistribution[entry.retryCount];
      }
    }

    await redis.setex(this.DLQ_STATS_KEY, 3600, JSON.stringify(stats));
  }

  private async calculateDLQStats(): Promise<DLQStats> {
    const entries = await redis.lrange(this.DLQ_KEY, 0, -1);
    const parsedEntries = entries.map((e: string) => JSON.parse(e) as DeadLetterEntry);

    const entriesByType: Record<string, number> = {};
    const retryDistribution: Record<number, number> = {};
    let totalProcessingTime = 0;
    let processingTimeCount = 0;
    let oldestEntry = Date.now();
    let newestEntry = 0;

    for (const entry of parsedEntries) {
      // Count by event type
      entriesByType[entry.event.type] = (entriesByType[entry.event.type] || 0) + 1;

      // Count by retry attempts
      retryDistribution[entry.retryCount] = (retryDistribution[entry.retryCount] || 0) + 1;

      // Track processing time
      if (entry.processingTime) {
        totalProcessingTime += entry.processingTime;
        processingTimeCount++;
      }

      // Track timestamps
      oldestEntry = Math.min(oldestEntry, entry.timestamp);
      newestEntry = Math.max(newestEntry, entry.timestamp);
    }

    return {
      totalEntries: parsedEntries.length,
      entriesByType,
      oldestEntry: parsedEntries.length > 0 ? oldestEntry : 0,
      newestEntry: parsedEntries.length > 0 ? newestEntry : 0,
      averageProcessingTime:
        processingTimeCount > 0 ? totalProcessingTime / processingTimeCount : 0,
      retryDistribution,
    };
  }
}

// Export singleton instance
export const deadLetterQueue = DeadLetterQueueService.getInstance();
