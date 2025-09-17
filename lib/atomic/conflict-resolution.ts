/**
 * Conflict Resolution and Optimistic Locking Service
 *
 * This service provides advanced conflict resolution mechanisms and optimistic locking
 * to prevent concurrent update conflicts in the atomic role management system.
 */

import { Redis } from '@upstash/redis';
import {
  OptimisticLockContext,
  ConflictResolution,
  ConflictType,
  AtomicOperationError,
  ATOMIC_REDIS_KEYS,
  ATOMIC_TTL,
} from './types';
import { getAtomicRoleUpdateService } from './redis-scripts';

/**
 * Conflict Resolution Strategies
 */
export enum ConflictResolutionStrategy {
  FAIL_FAST = 'fail_fast',
  RETRY_WITH_BACKOFF = 'retry_with_backoff',
  FORCE_UPDATE = 'force_update',
  MERGE_CHANGES = 'merge_changes',
  USER_INTERVENTION = 'user_intervention',
}

/**
 * Optimistic Locking Configuration
 */
export interface OptimisticLockingConfig {
  maxRetries: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  conflictResolutionStrategy: ConflictResolutionStrategy;
  lockTimeoutMs: number;
}

/**
 * Default Configuration
 */
const DEFAULT_CONFIG: OptimisticLockingConfig = {
  maxRetries: 3,
  baseBackoffMs: 100,
  maxBackoffMs: 5000,
  backoffMultiplier: 2,
  conflictResolutionStrategy: ConflictResolutionStrategy.RETRY_WITH_BACKOFF,
  lockTimeoutMs: ATOMIC_TTL.LOCK,
};

/**
 * Conflict Resolution and Optimistic Locking Service
 */
export class ConflictResolutionService {
  private redis: Redis;
  private atomicService: ReturnType<typeof getAtomicRoleUpdateService>;
  private config: OptimisticLockingConfig;

  constructor(redis: Redis, config: Partial<OptimisticLockingConfig> = {}) {
    this.redis = redis;
    this.atomicService = getAtomicRoleUpdateService(redis);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute operation with optimistic locking
   */
  async executeWithOptimisticLock<T>(
    userId: string,
    operation: (context: OptimisticLockContext) => Promise<T>,
    expectedVersion?: number,
  ): Promise<T> {
    const lockId = crypto.randomUUID();
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.config.maxRetries) {
      try {
        // Create lock context
        const lockContext: OptimisticLockContext = {
          userId,
          expectedVersion: expectedVersion || 0,
          lockAcquired: false,
          lockId,
          attempts: attempt,
          maxAttempts: this.config.maxRetries,
        };

        // Try to acquire optimistic lock
        const lockResult = await this.atomicService.acquireOptimisticLock(
          userId,
          expectedVersion || 0,
          30, // Lock TTL is hardcoded in Lua script
        );

        if (!lockResult.success) {
          if (lockResult.conflict) {
            // Handle version conflict
            const resolution = await this.resolveConflict(userId, lockResult, attempt);

            if (resolution.resolution === 'retry') {
              attempt++;
              await this.delay(this.calculateBackoff(attempt));
              continue;
            } else if (resolution.resolution === 'force') {
              // Force update by ignoring version
              expectedVersion = undefined;
              attempt++;
              continue;
            } else {
              throw new AtomicOperationError(
                `Conflict resolution failed: ${resolution.message}`,
                AtomicOperationError.CODES.VERSION_CONFLICT,
                {
                  userId,
                  retryable: false,
                  details: resolution,
                },
              );
            }
          } else {
            throw new AtomicOperationError(
              'Failed to acquire lock',
              AtomicOperationError.CODES.LOCK_ACQUISITION_FAILED,
              { userId, retryable: true },
            );
          }
        }

        // Lock acquired successfully
        lockContext.lockAcquired = true;
        lockContext.currentVersion = lockResult.version;
        lockContext.lockExpires = Date.now() + this.config.lockTimeoutMs;

        try {
          // Execute the operation
          const result = await operation(lockContext);

          // Release lock
          await this.atomicService.releaseOptimisticLock(userId);

          return result;
        } catch (operationError) {
          // Release lock on operation failure
          await this.atomicService.releaseOptimisticLock(userId);
          throw operationError;
        }
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt > this.config.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!(error instanceof AtomicOperationError) || !error.retryable) {
          break;
        }

        // Apply backoff delay
        await this.delay(this.calculateBackoff(attempt));
      }
    }

    // All retries exhausted
    throw new AtomicOperationError(
      `Optimistic locking failed after ${this.config.maxRetries} attempts`,
      AtomicOperationError.CODES.VERSION_CONFLICT,
      {
        userId,
        retryable: false,
        details: {
          lastError: lastError?.message,
          attempts: attempt,
          maxRetries: this.config.maxRetries,
        },
      },
    );
  }

  /**
   * Resolve version conflicts based on strategy
   */
  private async resolveConflict(
    userId: string,
    lockResult: { currentVersion?: number; expectedVersion?: number; [key: string]: unknown },
    attempt: number,
  ): Promise<ConflictResolution> {
    const currentVersion = lockResult.currentVersion || 0;
    const expectedVersion = lockResult.expectedVersion || 0;

    switch (this.config.conflictResolutionStrategy) {
      case ConflictResolutionStrategy.FAIL_FAST:
        return {
          type: ConflictType.VERSION_MISMATCH,
          message: `Version conflict: expected ${expectedVersion}, got ${currentVersion}`,
          resolution: 'abort',
          suggestedAction: 'Refresh data and retry manually',
        };

      case ConflictResolutionStrategy.RETRY_WITH_BACKOFF:
        if (attempt < this.config.maxRetries) {
          return {
            type: ConflictType.VERSION_MISMATCH,
            message: `Version conflict detected, retrying (${attempt + 1}/${this.config.maxRetries})`,
            resolution: 'retry',
            retryAfter: this.calculateBackoff(attempt + 1),
            suggestedAction: 'Automatic retry with backoff',
          };
        } else {
          return {
            type: ConflictType.VERSION_MISMATCH,
            message: `Version conflict: max retries exceeded`,
            resolution: 'abort',
            suggestedAction: 'Manual intervention required',
          };
        }

      case ConflictResolutionStrategy.FORCE_UPDATE:
        return {
          type: ConflictType.VERSION_MISMATCH,
          message: `Version conflict: forcing update`,
          resolution: 'force',
          suggestedAction: 'Update will proceed despite version conflict',
        };

      case ConflictResolutionStrategy.MERGE_CHANGES:
        // For role updates, merging doesn't make sense - use force or retry
        return {
          type: ConflictType.VERSION_MISMATCH,
          message: `Version conflict: merge not applicable for role updates`,
          resolution: 'force',
          suggestedAction: 'Forcing update as merge is not applicable',
        };

      case ConflictResolutionStrategy.USER_INTERVENTION:
        return {
          type: ConflictType.VERSION_MISMATCH,
          message: `Version conflict: user intervention required`,
          resolution: 'abort',
          suggestedAction: 'Please resolve conflict manually',
        };

      default:
        return {
          type: ConflictType.VERSION_MISMATCH,
          message: `Version conflict: unknown resolution strategy`,
          resolution: 'abort',
          suggestedAction: 'Contact administrator',
        };
    }
  }

  /**
   * Calculate backoff delay with jitter
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay =
      this.config.baseBackoffMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.1 * baseDelay; // 10% jitter
    const delay = Math.min(baseDelay + jitter, this.config.maxBackoffMs);
    return Math.floor(delay);
  }

  /**
   * Delay execution for backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check for potential conflicts before operation
   */
  async checkForConflicts(
    userId: string,
    expectedVersion?: number,
  ): Promise<{
    hasConflict: boolean;
    currentVersion?: number;
    expectedVersion?: number;
    recommendation: ConflictResolution;
  }> {
    try {
      const roleData = await this.atomicService.getRoleDataWithIntegrity(userId);

      if (!roleData) {
        return {
          hasConflict: false,
          currentVersion: 0,
          expectedVersion,
          recommendation: {
            type: ConflictType.VERSION_MISMATCH,
            message: 'No existing data',
            resolution: 'retry',
            suggestedAction: 'Proceed with operation',
          },
        };
      }

      if (expectedVersion !== undefined && roleData.version !== expectedVersion) {
        const recommendation = await this.resolveConflict(
          userId,
          {
            currentVersion: roleData.version,
            expectedVersion,
          },
          0,
        );

        return {
          hasConflict: true,
          currentVersion: roleData.version,
          expectedVersion,
          recommendation,
        };
      }

      return {
        hasConflict: false,
        currentVersion: roleData.version,
        expectedVersion,
        recommendation: {
          type: ConflictType.VERSION_MISMATCH,
          message: 'No conflict detected',
          resolution: 'retry',
          suggestedAction: 'Proceed with operation',
        },
      };
    } catch (error) {
      console.error('[ConflictResolution] Conflict check failed:', error);
      return {
        hasConflict: false,
        recommendation: {
          type: ConflictType.SERVICE_UNAVAILABLE,
          message: 'Unable to check for conflicts',
          resolution: 'abort',
          suggestedAction: 'Retry operation later',
        },
      };
    }
  }

  /**
   * Batch conflict detection for multiple users
   */
  async checkBatchConflicts(
    userVersionPairs: Array<{ userId: string; expectedVersion?: number }>,
  ): Promise<{
    hasConflicts: boolean;
    conflicts: Array<{
      userId: string;
      currentVersion: number;
      expectedVersion?: number;
      resolution: ConflictResolution;
    }>;
    safeToProceed: boolean;
  }> {
    const conflicts = [];

    for (const pair of userVersionPairs) {
      const check = await this.checkForConflicts(pair.userId, pair.expectedVersion);

      if (check.hasConflict) {
        conflicts.push({
          userId: pair.userId,
          currentVersion: check.currentVersion || 0,
          expectedVersion: pair.expectedVersion,
          resolution: check.recommendation,
        });
      }
    }

    const hasConflicts = conflicts.length > 0;
    const safeToProceed =
      !hasConflicts ||
      conflicts.every(
        (c) => c.resolution.resolution === 'force' || c.resolution.resolution === 'retry',
      );

    return {
      hasConflicts,
      conflicts,
      safeToProceed,
    };
  }

  /**
   * Force unlock a user (admin operation)
   */
  async forceUnlock(userId: string): Promise<boolean> {
    try {
      await this.atomicService.releaseOptimisticLock(userId);
      return true;
    } catch (error) {
      console.error('[ConflictResolution] Force unlock failed:', error);
      return false;
    }
  }

  /**
   * Get lock status for a user
   */
  async getLockStatus(userId: string): Promise<{
    isLocked: boolean;
    lockId?: string;
    expiresAt?: number;
    ttl?: number;
  }> {
    try {
      const lockKey = ATOMIC_REDIS_KEYS.OPERATION_LOCK(userId);
      const lockData = await this.redis.get(lockKey);

      if (!lockData) {
        return { isLocked: false };
      }

      const ttl = await this.redis.ttl(lockKey);

      return {
        isLocked: true,
        lockId: lockData as string,
        expiresAt: Date.now() + ttl * 1000,
        ttl,
      };
    } catch (error) {
      console.error('[ConflictResolution] Failed to get lock status:', error);
      return { isLocked: false };
    }
  }

  /**
   * Clean up stale locks
   */
  async cleanupStaleLocks(_maxAgeMs = 300000): Promise<number> {
    // This would require scanning all lock keys, which is expensive
    // For now, return 0 as locks have TTL
    console.warn('[ConflictResolution] Cleanup of stale locks not implemented');
    return 0;
  }

  /**
   * Get conflict statistics
   */
  async getConflictStats(_timeRangeMs = 3600000): Promise<{
    totalConflicts: number;
    conflictsByType: Record<ConflictType, number>;
    averageResolutionTime: number;
    successRate: number;
  }> {
    try {
      const conflictLogKey = ATOMIC_REDIS_KEYS.CONFLICT_LOG('stats');
      const statsData = await this.redis.get(conflictLogKey);

      if (!statsData) {
        return {
          totalConflicts: 0,
          conflictsByType: {} as Record<ConflictType, number>,
          averageResolutionTime: 0,
          successRate: 0,
        };
      }

      const stats = JSON.parse(statsData as string);

      return {
        totalConflicts: stats.totalConflicts || 0,
        conflictsByType: stats.conflictsByType || {},
        averageResolutionTime: stats.averageResolutionTime || 0,
        successRate: stats.successRate || 0,
      };
    } catch (error) {
      console.error('[ConflictResolution] Failed to get conflict stats:', error);
      return {
        totalConflicts: 0,
        conflictsByType: {} as Record<ConflictType, number>,
        averageResolutionTime: 0,
        successRate: 0,
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OptimisticLockingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): OptimisticLockingConfig {
    return { ...this.config };
  }
}

// Export singleton instance
let conflictResolutionService: ConflictResolutionService | null = null;

export function getConflictResolutionService(
  redis: Redis,
  config?: Partial<OptimisticLockingConfig>,
): ConflictResolutionService {
  if (!conflictResolutionService) {
    conflictResolutionService = new ConflictResolutionService(redis, config);
  }
  return conflictResolutionService;
}

// Export utilities
export { DEFAULT_CONFIG as defaultConflictResolutionConfig };
