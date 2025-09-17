/**
 * Webhook Idempotency Service
 *
 * Provides idempotency for webhook processing to prevent duplicate events
 * from being processed multiple times. Uses Redis for distributed state management.
 */

import { Redis } from '@upstash/redis'
import { z } from 'zod'
import crypto from 'crypto'

// Idempotency configuration
export const IdempotencyConfigSchema = z.object({
  ttl: z.number().default(86400), // 24 hours default TTL
  keyPrefix: z.string().default('webhook:idempotency'),
  maxRetries: z.number().default(3),
  retryDelay: z.number().default(1000), // 1 second
  cleanupInterval: z.number().default(3600000), // 1 hour
  enableCleanup: z.boolean().default(true)
})

export type IdempotencyConfig = z.infer<typeof IdempotencyConfigSchema>

// Idempotency record
export const IdempotencyRecordSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  eventType: z.string(),
  correlationId: z.string(),
  status: z.enum(['processing', 'completed', 'failed']),
  attempts: z.number().default(0),
  maxAttempts: z.number().default(3),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
  result: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
})

export type IdempotencyRecord = z.infer<typeof IdempotencyRecordSchema>

// Idempotency check result
export const IdempotencyCheckResultSchema = z.object({
  isDuplicate: z.boolean(),
  canProcess: z.boolean(),
  record: IdempotencyRecordSchema.nullable(),
  reason: z.string().optional(),
  retryAfter: z.number().optional()
})

export type IdempotencyCheckResult = z.infer<typeof IdempotencyCheckResultSchema>

// Idempotency operation result
export const IdempotencyOperationResultSchema = z.object({
  success: z.boolean(),
  record: IdempotencyRecordSchema,
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional()
})

export type IdempotencyOperationResult = z.infer<typeof IdempotencyOperationResultSchema>

// Idempotency error types
export enum IdempotencyError {
  DUPLICATE_EVENT = 'DUPLICATE_EVENT',
  PROCESSING_IN_PROGRESS = 'PROCESSING_IN_PROGRESS',
  MAX_ATTEMPTS_EXCEEDED = 'MAX_ATTEMPTS_EXCEEDED',
  REDIS_ERROR = 'REDIS_ERROR',
  INVALID_EVENT_ID = 'INVALID_EVENT_ID',
  LOCK_ACQUISITION_FAILED = 'LOCK_ACQUISITION_FAILED'
}

/**
 * Webhook Idempotency Service
 *
 * Manages idempotency keys to prevent duplicate webhook processing
 * with Redis-backed distributed state management.
 */
export class WebhookIdempotencyService {
  private redis: Redis
  private config: IdempotencyConfig
  private cleanupTimer?: NodeJS.Timeout

  constructor(redis: Redis, config: Partial<IdempotencyConfig> = {}) {
    this.redis = redis
    this.config = IdempotencyConfigSchema.parse(config)

    if (this.config.enableCleanup) {
      this.startCleanupTimer()
    }
  }

  /**
   * Check if an event can be processed (idempotency check)
   */
  async checkIdempotency(
    eventId: string,
    eventType: string,
    correlationId: string
  ): Promise<IdempotencyCheckResult> {
    if (!eventId || typeof eventId !== 'string') {
      return {
        isDuplicate: false,
        canProcess: false,
        record: null,
        reason: 'Invalid event ID'
      }
    }

    const key = this.generateKey(eventId)

    try {
      const existingRecord = await this.redis.get(key)

      if (!existingRecord) {
        // Event not seen before, can process
        return {
          isDuplicate: false,
          canProcess: true,
          record: null
        }
      }

      const record = IdempotencyRecordSchema.parse(JSON.parse(existingRecord as string))

      // Check if event is currently being processed
      if (record.status === 'processing') {
        return {
          isDuplicate: true,
          canProcess: false,
          record,
          reason: 'Event is currently being processed',
          retryAfter: 5000 // 5 seconds
        }
      }

      // Check if event was already completed successfully
      if (record.status === 'completed') {
        return {
          isDuplicate: true,
          canProcess: false,
          record,
          reason: 'Event already processed successfully'
        }
      }

      // Check if max attempts exceeded
      if (record.attempts >= record.maxAttempts) {
        return {
          isDuplicate: true,
          canProcess: false,
          record,
          reason: `Maximum retry attempts (${record.maxAttempts}) exceeded`
        }
      }

      // Event failed previously but can be retried
      return {
        isDuplicate: false,
        canProcess: true,
        record
      }

    } catch (error) {
      console.error('[Idempotency] Check failed:', error)
      // On Redis error, allow processing to avoid blocking valid events
      return {
        isDuplicate: false,
        canProcess: true,
        record: null,
        reason: 'Redis error, allowing processing'
      }
    }
  }

  /**
   * Start processing an event (acquire idempotency lock)
   */
  async startProcessing(
    eventId: string,
    eventType: string,
    correlationId: string,
    metadata: Record<string, any> = {}
  ): Promise<IdempotencyOperationResult> {
    const key = this.generateKey(eventId)
    const now = Date.now()

    try {
      // Check current state first
      const checkResult = await this.checkIdempotency(eventId, eventType, correlationId)

      if (!checkResult.canProcess) {
        return {
          success: false,
          record: checkResult.record || this.createEmptyRecord(eventId, eventType, correlationId),
          error: {
            code: IdempotencyError.DUPLICATE_EVENT,
            message: checkResult.reason || 'Cannot process event',
            details: checkResult
          }
        }
      }

      // Create or update idempotency record
      const record: IdempotencyRecord = {
        id: crypto.randomUUID(),
        eventId,
        eventType,
        correlationId,
        status: 'processing',
        attempts: (checkResult.record?.attempts || 0) + 1,
        maxAttempts: this.config.maxRetries,
        createdAt: checkResult.record?.createdAt || now,
        updatedAt: now,
        metadata: {
          ...checkResult.record?.metadata,
          ...metadata,
          lastAttemptAt: now
        }
      }

      // Store in Redis with TTL
      await this.redis.setex(key, this.config.ttl, JSON.stringify(record))

      return {
        success: true,
        record
      }

    } catch (error) {
      console.error('[Idempotency] Start processing failed:', error)
      return {
        success: false,
        record: this.createEmptyRecord(eventId, eventType, correlationId),
        error: {
          code: IdempotencyError.REDIS_ERROR,
          message: 'Failed to start processing',
          details: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }

  /**
   * Mark event processing as completed
   */
  async markCompleted(
    eventId: string,
    result?: any,
    metadata: Record<string, any> = {}
  ): Promise<IdempotencyOperationResult> {
    const key = this.generateKey(eventId)
    const now = Date.now()

    try {
      const existingData = await this.redis.get(key)

      if (!existingData) {
        return {
          success: false,
          record: this.createEmptyRecord(eventId, '', ''),
          error: {
            code: IdempotencyError.INVALID_EVENT_ID,
            message: 'Event not found in idempotency store'
          }
        }
      }

      const record = IdempotencyRecordSchema.parse(JSON.parse(existingData as string))

      // Update record with completion status
      const updatedRecord: IdempotencyRecord = {
        ...record,
        status: 'completed',
        updatedAt: now,
        completedAt: now,
        result,
        metadata: {
          ...record.metadata,
          ...metadata,
          completedAt: now
        }
      }

      // Store updated record
      await this.redis.setex(key, this.config.ttl, JSON.stringify(updatedRecord))

      return {
        success: true,
        record: updatedRecord
      }

    } catch (error) {
      console.error('[Idempotency] Mark completed failed:', error)
      return {
        success: false,
        record: this.createEmptyRecord(eventId, '', ''),
        error: {
          code: IdempotencyError.REDIS_ERROR,
          message: 'Failed to mark as completed',
          details: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }

  /**
   * Mark event processing as failed
   */
  async markFailed(
    eventId: string,
    error: { code: string; message: string; stack?: string },
    metadata: Record<string, any> = {}
  ): Promise<IdempotencyOperationResult> {
    const key = this.generateKey(eventId)
    const now = Date.now()

    try {
      const existingData = await this.redis.get(key)

      if (!existingData) {
        return {
          success: false,
          record: this.createEmptyRecord(eventId, '', ''),
          error: {
            code: IdempotencyError.INVALID_EVENT_ID,
            message: 'Event not found in idempotency store'
          }
        }
      }

      const record = IdempotencyRecordSchema.parse(JSON.parse(existingData as string))

      // Check if max attempts exceeded
      if (record.attempts >= record.maxAttempts) {
        const updatedRecord: IdempotencyRecord = {
          ...record,
          status: 'failed',
          updatedAt: now,
          error,
          metadata: {
            ...record.metadata,
            ...metadata,
            failedAt: now,
            maxAttemptsExceeded: true
          }
        }

        await this.redis.setex(key, this.config.ttl, JSON.stringify(updatedRecord))

        return {
          success: false,
          record: updatedRecord,
          error: {
            code: IdempotencyError.MAX_ATTEMPTS_EXCEEDED,
            message: 'Maximum retry attempts exceeded'
          }
        }
      }

      // Update record but keep as processing for potential retry
      const updatedRecord: IdempotencyRecord = {
        ...record,
        updatedAt: now,
        error,
        metadata: {
          ...record.metadata,
          ...metadata,
          lastFailedAt: now,
          lastError: error
        }
      }

      await this.redis.setex(key, this.config.ttl, JSON.stringify(updatedRecord))

      return {
        success: true,
        record: updatedRecord
      }

    } catch (redisError) {
      console.error('[Idempotency] Mark failed error:', redisError)
      return {
        success: false,
        record: this.createEmptyRecord(eventId, '', ''),
        error: {
          code: IdempotencyError.REDIS_ERROR,
          message: 'Failed to mark as failed',
          details: redisError instanceof Error ? redisError.message : String(redisError)
        }
      }
    }
  }

  /**
   * Get idempotency record for an event
   */
  async getRecord(eventId: string): Promise<IdempotencyRecord | null> {
    const key = this.generateKey(eventId)

    try {
      const data = await this.redis.get(key)

      if (!data) {
        return null
      }

      return IdempotencyRecordSchema.parse(JSON.parse(data as string))
    } catch (error) {
      console.error('[Idempotency] Get record failed:', error)
      return null
    }
  }

  /**
   * Delete idempotency record
   */
  async deleteRecord(eventId: string): Promise<boolean> {
    const key = this.generateKey(eventId)

    try {
      await this.redis.del(key)
      return true
    } catch (error) {
      console.error('[Idempotency] Delete record failed:', error)
      return false
    }
  }

  /**
   * Clean up expired idempotency records
   */
  async cleanupExpiredRecords(): Promise<number> {
    try {
      // Get all keys matching the pattern
      const pattern = `${this.config.keyPrefix}:*`
      const keys = await this.redis.keys(pattern)

      let cleanedCount = 0

      for (const key of keys) {
        try {
          const data = await this.redis.get(key)

          if (data) {
            const record = IdempotencyRecordSchema.parse(JSON.parse(data as string))
            const age = Date.now() - record.createdAt
            const maxAge = this.config.ttl * 1000

            // Delete if older than TTL
            if (age > maxAge) {
              await this.redis.del(key)
              cleanedCount++
            }
          }
        } catch (error) {
          // If parsing fails, delete the key
          await this.redis.del(key)
          cleanedCount++
        }
      }

      console.log(`[Idempotency] Cleaned up ${cleanedCount} expired records`)
      return cleanedCount

    } catch (error) {
      console.error('[Idempotency] Cleanup failed:', error)
      return 0
    }
  }

  /**
   * Get idempotency statistics
   */
  async getStatistics(): Promise<{
    totalRecords: number
    processingRecords: number
    completedRecords: number
    failedRecords: number
    averageProcessingTime: number
    oldestRecord: number | null
    newestRecord: number | null
  }> {
    try {
      const pattern = `${this.config.keyPrefix}:*`
      const keys = await this.redis.keys(pattern)

      let totalRecords = 0
      let processingRecords = 0
      let completedRecords = 0
      let failedRecords = 0
      let totalProcessingTime = 0
      let completedCount = 0
      let oldestRecord: number | null = null
      let newestRecord: number | null = null

      for (const key of keys) {
        try {
          const data = await this.redis.get(key)

          if (data) {
            const record = IdempotencyRecordSchema.parse(JSON.parse(data as string))
            totalRecords++

            if (record.status === 'processing') processingRecords++
            if (record.status === 'completed') completedRecords++
            if (record.status === 'failed') failedRecords++

            if (record.completedAt && record.createdAt) {
              const processingTime = record.completedAt - record.createdAt
              totalProcessingTime += processingTime
              completedCount++
            }

            if (!oldestRecord || record.createdAt < oldestRecord) {
              oldestRecord = record.createdAt
            }

            if (!newestRecord || record.createdAt > newestRecord) {
              newestRecord = record.createdAt
            }
          }
        } catch (error) {
          // Skip invalid records
          continue
        }
      }

      const averageProcessingTime = completedCount > 0 ? totalProcessingTime / completedCount : 0

      return {
        totalRecords,
        processingRecords,
        completedRecords,
        failedRecords,
        averageProcessingTime,
        oldestRecord,
        newestRecord
      }

    } catch (error) {
      console.error('[Idempotency] Statistics failed:', error)
      return {
        totalRecords: 0,
        processingRecords: 0,
        completedRecords: 0,
        failedRecords: 0,
        averageProcessingTime: 0,
        oldestRecord: null,
        newestRecord: null
      }
    }
  }

  /**
   * Generate Redis key for idempotency record
   */
  private generateKey(eventId: string): string {
    return `${this.config.keyPrefix}:${eventId}`
  }

  /**
   * Create empty idempotency record
   */
  private createEmptyRecord(eventId: string, eventType: string, correlationId: string): IdempotencyRecord {
    return {
      id: crypto.randomUUID(),
      eventId,
      eventType,
      correlationId,
      status: 'failed',
      attempts: 0,
      maxAttempts: this.config.maxRetries,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {}
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredRecords()
      } catch (error) {
        console.error('[Idempotency] Cleanup timer error:', error)
      }
    }, this.config.cleanupInterval)
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IdempotencyConfig>): void {
    const oldConfig = { ...this.config }
    this.config = IdempotencyConfigSchema.parse({
      ...this.config,
      ...newConfig
    })

    // Restart cleanup timer if interval changed
    if (oldConfig.cleanupInterval !== this.config.cleanupInterval) {
      this.stopCleanup()
      if (this.config.enableCleanup) {
        this.startCleanupTimer()
      }
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): IdempotencyConfig {
    return { ...this.config }
  }
}

// Export singleton instance
let idempotencyService: WebhookIdempotencyService | null = null

export function getWebhookIdempotencyService(
  redis: Redis,
  config?: Partial<IdempotencyConfig>
): WebhookIdempotencyService {
  if (!idempotencyService) {
    idempotencyService = new WebhookIdempotencyService(redis, config)
  }
  return idempotencyService
}

// Export utilities
export const DEFAULT_IDEMPOTENCY_CONFIG: Partial<IdempotencyConfig> = {
  ttl: 86400, // 24 hours
  keyPrefix: 'webhook:idempotency',
  maxRetries: 3,
  retryDelay: 1000,
  cleanupInterval: 3600000, // 1 hour
  enableCleanup: true
}