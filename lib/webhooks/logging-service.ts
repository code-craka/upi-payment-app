import { redis } from '@/lib/redis';
import { RedisCircuitBreaker } from '@/lib/redis/circuit-breaker';
import { WebhookEvent } from '@clerk/nextjs/server';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  correlationId: string;
  eventType?: string;
  userId?: string;
  operation: string;
  message: string;
  metadata?: Record<string, any>;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  source: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LogStats {
  totalLogs: number;
  logsByLevel: Record<string, number>;
  logsByOperation: Record<string, number>;
  logsBySource: Record<string, number>;
  averageDuration: number;
  errorRate: number;
  recentErrors: LogEntry[];
  oldestLog: number;
  newestLog: number;
}

export interface LogQuery {
  correlationId?: string;
  level?: LogEntry['level'];
  operation?: string;
  source?: string;
  userId?: string;
  eventType?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

export class WebhookLoggingService {
  private static instance: WebhookLoggingService;
  private circuitBreaker: RedisCircuitBreaker;
  private readonly LOG_KEY = 'webhook:logs';
  private readonly LOG_STATS_KEY = 'webhook:logs:stats';
  private readonly LOG_INDEX_KEY = 'webhook:logs:index';
  private readonly MAX_LOGS = 10000;
  private readonly LOG_TTL = 30 * 24 * 60 * 60; // 30 days

  private constructor() {
    this.circuitBreaker = new RedisCircuitBreaker();
  }

  static getInstance(): WebhookLoggingService {
    if (!WebhookLoggingService.instance) {
      WebhookLoggingService.instance = new WebhookLoggingService();
    }
    return WebhookLoggingService.instance;
  }

  /**
   * Log a webhook-related event
   */
  async log(
    level: LogEntry['level'],
    operation: string,
    message: string,
    options: {
      correlationId?: string;
      event?: WebhookEvent;
      userId?: string;
      metadata?: Record<string, any>;
      duration?: number;
      error?: Error;
      source?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<string> {
    const logEntry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      correlationId: options.correlationId || crypto.randomUUID(),
      eventType: options.event?.type,
      userId: options.userId,
      operation,
      message,
      metadata: options.metadata,
      duration: options.duration,
      source: options.source || 'webhook-service',
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    };

    if (options.error) {
      logEntry.error = {
        name: options.error.name,
        message: options.error.message,
        stack: options.error.stack,
      };
    }

    try {
      await this.circuitBreaker.execute(async () => {
        // Add to logs list
        await redis.lpush(this.LOG_KEY, JSON.stringify(logEntry));

        // Set TTL for the log entry
        await redis.expire(this.LOG_KEY, this.LOG_TTL);

        // Add to correlation ID index
        if (logEntry.correlationId) {
          await redis.sadd(`${this.LOG_INDEX_KEY}:correlation:${logEntry.correlationId}`, logEntry.id);
          await redis.expire(`${this.LOG_INDEX_KEY}:correlation:${logEntry.correlationId}`, this.LOG_TTL);
        }

        // Add to operation index
        await redis.sadd(`${this.LOG_INDEX_KEY}:operation:${operation}`, logEntry.id);
        await redis.expire(`${this.LOG_INDEX_KEY}:operation:${operation}`, this.LOG_TTL);

        // Add to level index
        await redis.sadd(`${this.LOG_INDEX_KEY}:level:${level}`, logEntry.id);
        await redis.expire(`${this.LOG_INDEX_KEY}:level:${level}`, this.LOG_TTL);

        // Trim logs if exceeding max
        await redis.ltrim(this.LOG_KEY, 0, this.MAX_LOGS - 1);

        // Update statistics
        await this.updateLogStats(logEntry);
      });

      // Console logging for development
      if (process.env.NODE_ENV === 'development') {
        const logMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
        console[logMethod](`[${level.toUpperCase()}] ${operation}: ${message}`, {
          correlationId: logEntry.correlationId,
          eventType: logEntry.eventType,
          duration: logEntry.duration,
        });
      }

      return logEntry.id;
    } catch (circuitError) {
      console.error('Failed to log webhook event due to circuit breaker:', circuitError);
      // Don't throw - logging failures shouldn't break the main flow
      return logEntry.id;
    }
  }

  /**
   * Query logs with filtering options
   */
  async queryLogs(query: LogQuery = {}): Promise<LogEntry[]> {
    try {
      return await this.circuitBreaker.execute(async () => {
        let candidateIds: string[] = [];

        // If correlation ID is specified, use the index
        if (query.correlationId) {
          const ids = await redis.smembers(`${this.LOG_INDEX_KEY}:correlation:${query.correlationId}`);
          candidateIds = ids as string[];
        } else {
          // Get all log entries
          const entries = await redis.lrange(this.LOG_KEY, 0, -1);
          candidateIds = entries.map((entry: string) => {
            const parsed = JSON.parse(entry) as LogEntry;
            return parsed.id;
          });
        }

        // Filter entries
        const filteredEntries: LogEntry[] = [];
        const limit = query.limit || 100;
        const offset = query.offset || 0;
        let count = 0;

        for (const entryStr of await redis.lrange(this.LOG_KEY, 0, -1)) {
          const entry = JSON.parse(entryStr) as LogEntry;

          // Apply filters
          if (query.level && entry.level !== query.level) continue;
          if (query.operation && entry.operation !== query.operation) continue;
          if (query.source && entry.source !== query.source) continue;
          if (query.userId && entry.userId !== query.userId) continue;
          if (query.eventType && entry.eventType !== query.eventType) continue;
          if (query.startTime && entry.timestamp < query.startTime) continue;
          if (query.endTime && entry.timestamp > query.endTime) continue;

          if (count >= offset && filteredEntries.length < limit) {
            filteredEntries.push(entry);
          }
          count++;

          if (filteredEntries.length >= limit) break;
        }

        // Sort by timestamp (newest first)
        return filteredEntries.sort((a, b) => b.timestamp - a.timestamp);
      });
    } catch (error) {
      console.error('Failed to query logs:', error);
      return [];
    }
  }

  /**
   * Get logs for a specific correlation ID
   */
  async getLogsByCorrelationId(correlationId: string, limit: number = 50): Promise<LogEntry[]> {
    return this.queryLogs({ correlationId, limit });
  }

  /**
   * Get logs for a specific operation
   */
  async getLogsByOperation(operation: string, limit: number = 50): Promise<LogEntry[]> {
    return this.queryLogs({ operation, limit });
  }

  /**
   * Get error logs
   */
  async getErrorLogs(limit: number = 50): Promise<LogEntry[]> {
    return this.queryLogs({ level: 'error', limit });
  }

  /**
   * Get recent logs
   */
  async getRecentLogs(limit: number = 50): Promise<LogEntry[]> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const entries = await redis.lrange(this.LOG_KEY, 0, limit - 1);
        return (entries as string[]).map((entry: string) => JSON.parse(entry) as LogEntry)
          .sort((a, b) => b.timestamp - a.timestamp);
      });
    } catch (error) {
      console.error('Failed to get recent logs:', error);
      return [];
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(): Promise<LogStats> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const stats = await redis.get(this.LOG_STATS_KEY);
        if (stats) {
          return JSON.parse(stats as string);
        }

        // Calculate stats from current logs
        return await this.calculateLogStats();
      });
    } catch (error) {
      console.error('Failed to get log stats:', error);
      return {
        totalLogs: 0,
        logsByLevel: {},
        logsByOperation: {},
        logsBySource: {},
        averageDuration: 0,
        errorRate: 0,
        recentErrors: [],
        oldestLog: 0,
        newestLog: 0,
      };
    }
  }

  /**
   * Clean up old logs (logs older than TTL)
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const entries = await redis.lrange(this.LOG_KEY, 0, -1);
        const cutoffTime = Date.now() - (this.LOG_TTL * 1000);
        let removedCount = 0;

        for (const entryStr of entries as string[]) {
          const entry = JSON.parse(entryStr) as LogEntry;
          if (entry.timestamp < cutoffTime) {
            await redis.lrem(this.LOG_KEY, 0, entryStr);
            removedCount++;

            // Clean up indexes
            if (entry.correlationId) {
              await redis.srem(`${this.LOG_INDEX_KEY}:correlation:${entry.correlationId}`, entry.id);
            }
            await redis.srem(`${this.LOG_INDEX_KEY}:operation:${entry.operation}`, entry.id);
            await redis.srem(`${this.LOG_INDEX_KEY}:level:${entry.level}`, entry.id);
          }
        }

        if (removedCount > 0) {
          console.log(`Cleaned up ${removedCount} old log entries`);
        }

        return removedCount;
      });
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
      return 0;
    }
  }

  /**
   * Clear all logs (admin operation)
   */
  async clearLogs(): Promise<number> {
    try {
      return await this.circuitBreaker.execute(async () => {
        const count = await redis.llen(this.LOG_KEY);
        await redis.del(this.LOG_KEY);
        await redis.del(this.LOG_STATS_KEY);

        // Clear all indexes (this is a simplified approach)
        const indexKeys = await redis.keys(`${this.LOG_INDEX_KEY}:*`);
        if (indexKeys.length > 0) {
          await redis.del(...indexKeys);
        }

        console.log(`Cleared ${count} log entries`);
        return count;
      });
    } catch (error) {
      console.error('Failed to clear logs:', error);
      return 0;
    }
  }

  /**
   * Get logs with performance metrics
   */
  async getPerformanceLogs(operation?: string, timeRange: number = 3600000): Promise<LogEntry[]> {
    const endTime = Date.now();
    const startTime = endTime - timeRange;

    return this.queryLogs({
      operation,
      startTime,
      endTime,
      limit: 1000,
    });
  }

  private async updateLogStats(entry: LogEntry): Promise<void> {
    const stats = await this.calculateLogStats();

    // Update level distribution
    stats.logsByLevel[entry.level] = (stats.logsByLevel[entry.level] || 0) + 1;

    // Update operation distribution
    stats.logsByOperation[entry.operation] = (stats.logsByOperation[entry.operation] || 0) + 1;

    // Update source distribution
    stats.logsBySource[entry.source] = (stats.logsBySource[entry.source] || 0) + 1;

    // Update timestamps
    if (stats.totalLogs === 0) {
      stats.oldestLog = entry.timestamp;
      stats.newestLog = entry.timestamp;
    } else {
      stats.oldestLog = Math.min(stats.oldestLog, entry.timestamp);
      stats.newestLog = Math.max(stats.newestLog, entry.timestamp);
    }

    // Update recent errors
    if (entry.level === 'error') {
      stats.recentErrors.unshift(entry);
      stats.recentErrors = stats.recentErrors.slice(0, 10); // Keep only 10 most recent
    }

    await redis.setex(this.LOG_STATS_KEY, 3600, JSON.stringify(stats)); // Cache for 1 hour
  }

  private async calculateLogStats(): Promise<LogStats> {
    const entries = await redis.lrange(this.LOG_KEY, 0, -1);
    const parsedEntries = (entries as string[]).map((entry: string) => JSON.parse(entry) as LogEntry);

    const logsByLevel: Record<string, number> = {};
    const logsByOperation: Record<string, number> = {};
    const logsBySource: Record<string, number> = {};
    const recentErrors: LogEntry[] = [];
    let totalDuration = 0;
    let durationCount = 0;
    let oldestLog = Date.now();
    let newestLog = 0;

    for (const entry of parsedEntries) {
      // Count by level
      logsByLevel[entry.level] = (logsByLevel[entry.level] || 0) + 1;

      // Count by operation
      logsByOperation[entry.operation] = (logsByOperation[entry.operation] || 0) + 1;

      // Count by source
      logsBySource[entry.source] = (logsBySource[entry.source] || 0) + 1;

      // Track recent errors
      if (entry.level === 'error') {
        recentErrors.push(entry);
      }

      // Track duration
      if (entry.duration) {
        totalDuration += entry.duration;
        durationCount++;
      }

      // Track timestamps
      oldestLog = Math.min(oldestLog, entry.timestamp);
      newestLog = Math.max(newestLog, entry.timestamp);
    }

    const totalLogs = parsedEntries.length;
    const errorLogs = logsByLevel['error'] || 0;
    const errorRate = totalLogs > 0 ? errorLogs / totalLogs : 0;

    return {
      totalLogs,
      logsByLevel,
      logsByOperation,
      logsBySource,
      averageDuration: durationCount > 0 ? totalDuration / durationCount : 0,
      errorRate,
      recentErrors: recentErrors.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10),
      oldestLog: totalLogs > 0 ? oldestLog : 0,
      newestLog: totalLogs > 0 ? newestLog : 0,
    };
  }
}

// Export singleton instance
export const webhookLogger = WebhookLoggingService.getInstance();