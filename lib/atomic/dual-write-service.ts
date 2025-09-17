/**
 * Dual-Write Role Update Service
 *
 * This service implements atomic role updates across both Clerk and Redis
 * with comprehensive rollback capabilities, conflict resolution, and monitoring.
 */

import { clerkClient } from '@clerk/nextjs/server';
import { Redis } from '@upstash/redis';
import {
  AtomicRoleUpdateRequest,
  AtomicRoleUpdateResponse,
  DualWriteTransaction,
  ConflictResolution,
  ConflictType,
  AtomicOperationError,
  AtomicAuditLogEntry,
  AtomicOperationType,
  UserRole,
  ATOMIC_TTL,
} from './types';
import { getAtomicRoleUpdateService } from './redis-scripts';
import { redisCircuitBreaker } from '../redis/circuit-breaker';

/**
 * Dual-Write Role Update Service
 *
 * Coordinates atomic role updates between Clerk (source of truth) and Redis (cache)
 * with comprehensive error handling, rollback, and monitoring.
 */
export class DualWriteRoleUpdateService {
  private readonly redis: Redis;
  private readonly atomicService: ReturnType<typeof getAtomicRoleUpdateService>;

  constructor(redis: Redis) {
    this.redis = redis;
    this.atomicService = getAtomicRoleUpdateService(redis);
  }

  /**
   * Execute atomic role update with dual-write pattern
   */
  async executeRoleUpdate(
    request: AtomicRoleUpdateRequest,
    initiatedBy: string,
    initiatedByEmail: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AtomicRoleUpdateResponse> {
    const operationId = crypto.randomUUID();
    const startTime = Date.now();

    const transaction: DualWriteTransaction = {
      transactionId: operationId,
      userId: request.userId,
      state: 'initiated',
      createdAt: startTime,
      updatedAt: startTime,
      timeout: request.timeout,
    };

    try {
      // 1. Check circuit breaker
      const circuitCheck = await this.atomicService.checkCircuitBreaker(
        AtomicOperationType.ROLE_UPDATE,
        false,
        0,
      );

      if (!circuitCheck.success) {
        throw new AtomicOperationError(
          'Circuit breaker check failed',
          AtomicOperationError.CODES.SERVICE_UNAVAILABLE,
          { operationId, userId: request.userId, retryable: true },
        );
      }

      // Check circuit state from data
      const circuitData = circuitCheck.data as { circuitState?: string } | undefined;
      if (circuitData?.circuitState === 'OPEN') {
        throw new AtomicOperationError(
          'Circuit breaker is open',
          AtomicOperationError.CODES.CIRCUIT_BREAKER_OPEN,
          { operationId, userId: request.userId, retryable: true },
        );
      }

      // 2. Get current role from Clerk (source of truth)
      const clerkStart = Date.now();
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(request.userId);
      const currentRole = (clerkUser.publicMetadata?.role as string) || null;
      const clerkLatency = Date.now() - clerkStart;

      transaction.clerkResult = {
        success: true,
        latency: clerkLatency,
      };
      transaction.state = 'clerk_updated';
      transaction.updatedAt = Date.now();

      // 3. Check for version conflicts
      if (!request.force && request.expectedVersion !== undefined) {
        const roleData = await this.atomicService.getRoleDataWithIntegrity(request.userId);
        if (roleData && roleData.version !== request.expectedVersion) {
          const conflict: ConflictResolution = {
            type: ConflictType.VERSION_MISMATCH,
            message: `Version mismatch: expected ${request.expectedVersion}, got ${roleData.version}`,
            resolution: 'retry',
            suggestedAction: 'Refresh data and retry with correct version',
          };

          await this.logAuditEntry({
            id: crypto.randomUUID(),
            operationId,
            operationType: AtomicOperationType.ROLE_UPDATE,
            userId: initiatedBy,
            targetUserId: request.userId,
            previousRole: currentRole as UserRole | null,
            newRole: request.newRole,
            version: roleData.version,
            initiatedBy,
            initiatedByEmail,
            reason: request.reason,
            success: false,
            clerkUpdated: false,
            redisUpdated: false,
            conflicts: [conflict],
            performance: {
              clerkLatency,
              totalLatency: Date.now() - startTime,
              retryCount: 0,
            },
            ipAddress,
            userAgent,
            timestamp: startTime,
          });

          return {
            success: false,
            userId: request.userId,
            previousRole: currentRole as UserRole | null,
            newRole: request.newRole,
            version: roleData.version,
            clerkUpdated: false,
            redisUpdated: false,
            operationId,
            timestamp: Date.now(),
            latency: {
              clerk: clerkLatency,
              total: Date.now() - startTime,
            },
            conflicts: [conflict],
          };
        }
      }

      // 4. Store rollback data
      const rollbackData = {
        roleData: currentRole
          ? JSON.stringify({
              userId: request.userId,
              role: currentRole,
              version: 0, // Will be updated with actual version
              lastModified: Date.now(),
            })
          : undefined,
        version: 0, // Will be updated
        checksum: '', // Will be updated
        ttl: ATOMIC_TTL.ROLE_DATA,
      };

      // Get current Redis data for rollback
      const currentRedisData = await this.atomicService.getRoleDataWithIntegrity(request.userId);
      if (currentRedisData) {
        rollbackData.roleData = JSON.stringify(currentRedisData.data);
        rollbackData.version = currentRedisData.version;
        rollbackData.checksum = currentRedisData.checksum;
      }

      await this.atomicService.storeRollbackData(operationId, request.userId, rollbackData);

      // 5. Update Clerk (source of truth)
      const clerkUpdateStart = Date.now();
      const clerkForUpdate = await clerkClient();
      await clerkForUpdate.users.updateUser(request.userId, {
        publicMetadata: {
          ...clerkUser.publicMetadata,
          role: request.newRole,
          lastRoleUpdate: Date.now(),
          updatedBy: initiatedBy,
        },
      });
      const clerkUpdateLatency = Date.now() - clerkUpdateStart;

      transaction.clerkResult = {
        success: true,
        latency: clerkUpdateLatency,
      };
      transaction.state = 'clerk_updated';
      transaction.updatedAt = Date.now();

      // 6. Update Redis atomically
      const redisStart = Date.now();
      const redisResult = await this.atomicService.executeAtomicRoleUpdate(
        request.userId,
        request.newRole,
        request.expectedVersion,
        request.force,
      );
      const redisLatency = Date.now() - redisStart;

      if (!redisResult.success) {
        // Redis update failed - rollback Clerk
        await DualWriteRoleUpdateService.rollbackClerkUpdate(
          request.userId,
          clerkUser.publicMetadata,
          operationId,
        );
        throw new AtomicOperationError(
          'Redis update failed',
          AtomicOperationError.CODES.REDIS_UPDATE_FAILED,
          { operationId, userId: request.userId, retryable: true },
        );
      }

      transaction.redisResult = {
        success: true,
        latency: redisLatency,
        version: redisResult.version,
      };
      transaction.state = 'redis_updated';
      transaction.updatedAt = Date.now();

      // 7. Mark transaction as committed
      transaction.state = 'committed';
      transaction.updatedAt = Date.now();

      // 8. Clean up rollback data
      await this.atomicService.cleanupOperation(request.userId, operationId);

      // 9. Update circuit breaker with success
      await this.atomicService.checkCircuitBreaker(
        AtomicOperationType.ROLE_UPDATE,
        true,
        Date.now() - startTime,
      );

      // 10. Log successful audit entry
      await this.logAuditEntry({
        id: crypto.randomUUID(),
        operationId,
        operationType: AtomicOperationType.ROLE_UPDATE,
        userId: initiatedBy,
        targetUserId: request.userId,
        previousRole: currentRole as UserRole | null,
        newRole: request.newRole,
        version: redisResult.version || 1,
        initiatedBy,
        initiatedByEmail,
        reason: request.reason,
        success: true,
        clerkUpdated: true,
        redisUpdated: true,
        performance: {
          clerkLatency: clerkUpdateLatency,
          redisLatency,
          totalLatency: Date.now() - startTime,
          retryCount: 0,
        },
        metadata: request.metadata,
        ipAddress,
        userAgent,
        timestamp: startTime,
        completedAt: Date.now(),
      });

      return {
        success: true,
        userId: request.userId,
        previousRole: currentRole as UserRole | null,
        newRole: request.newRole,
        version: redisResult.version || 1,
        clerkUpdated: true,
        redisUpdated: true,
        operationId,
        timestamp: Date.now(),
        latency: {
          clerk: clerkUpdateLatency,
          redis: redisLatency,
          total: Date.now() - startTime,
        },
      };
    } catch (error) {
      // Handle failure and rollback
      const failureTime = Date.now();
      const totalLatency = failureTime - startTime;

      transaction.state = 'failed';
      transaction.updatedAt = failureTime;

      // Attempt rollback if Clerk was updated
      if (transaction.clerkResult?.success) {
        try {
          await DualWriteRoleUpdateService.rollbackClerkUpdate(
            request.userId,
            undefined,
            operationId,
          );
          transaction.rollbackResult = {
            success: true,
            latency: Date.now() - failureTime,
          };
        } catch (rollbackError) {
          console.error('[DualWriteRoleUpdate] Rollback failed:', rollbackError);
          transaction.rollbackResult = {
            success: false,
            error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error',
            latency: Date.now() - failureTime,
          };
        }
      }

      // Update circuit breaker with failure
      await this.atomicService.checkCircuitBreaker(
        AtomicOperationType.ROLE_UPDATE,
        false,
        totalLatency,
      );

      // Log failure audit entry
      await this.logAuditEntry({
        id: crypto.randomUUID(),
        operationId,
        operationType: AtomicOperationType.ROLE_UPDATE,
        userId: initiatedBy,
        targetUserId: request.userId,
        previousRole: null, // We don't know the previous role on failure
        newRole: request.newRole,
        version: 0,
        initiatedBy,
        initiatedByEmail,
        reason: request.reason,
        success: false,
        clerkUpdated: transaction.clerkResult?.success || false,
        redisUpdated: transaction.redisResult?.success || false,
        error: {
          code: error instanceof AtomicOperationError ? error.code : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        performance: {
          totalLatency,
          retryCount: 0,
        },
        metadata: request.metadata,
        ipAddress,
        userAgent,
        timestamp: startTime,
        completedAt: failureTime,
      });

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Rollback Clerk update
   */
  private static async rollbackClerkUpdate(
    userId: string,
    originalMetadata: Record<string, unknown> | undefined,
    operationId: string,
  ): Promise<void> {
    try {
      const clerk = await clerkClient();
      await clerk.users.updateUser(userId, {
        publicMetadata: {
          ...originalMetadata,
          rollbackOperationId: operationId,
          rolledBackAt: Date.now(),
        },
      });
    } catch (error) {
      console.error('[DualWriteRoleUpdate] Clerk rollback failed:', error);
      throw new AtomicOperationError(
        'Clerk rollback failed',
        AtomicOperationError.CODES.ROLLBACK_FAILED,
        { operationId, userId, retryable: false },
      );
    }
  }

  /**
   * Execute rollback for failed operation
   */
  async executeRollback(operationId: string, userId: string): Promise<void> {
    try {
      // Rollback Redis first
      await this.atomicService.executeRollback(userId, operationId);

      // Get rollback context to restore Clerk
      const rollbackKey = `atomic:rollback:data:${operationId}`;
      const rollbackData = await this.redis.get(rollbackKey);

      if (rollbackData) {
        const rollback = JSON.parse(rollbackData as string);

        // Restore Clerk metadata if available
        if (rollback.clerkMetadata) {
          const clerk = await clerkClient();
          await clerk.users.updateUser(userId, {
            publicMetadata: {
              ...rollback.clerkMetadata,
              rollbackCompleted: true,
              rollbackOperationId: operationId,
            },
          });
        }
      }

      // Clean up
      await this.atomicService.cleanupOperation(userId, operationId);
    } catch (error) {
      console.error('[DualWriteRoleUpdate] Rollback execution failed:', error);
      throw new AtomicOperationError(
        'Rollback execution failed',
        AtomicOperationError.CODES.ROLLBACK_FAILED,
        { operationId, userId, retryable: false },
      );
    }
  }

  /**
   * Get operation status
   */
  async getOperationStatus(operationId: string): Promise<DualWriteTransaction | null> {
    try {
      const transactionKey = `atomic:transaction:state:${operationId}`;
      const transactionData = await this.redis.get(transactionKey);

      if (!transactionData) {
        return null;
      }

      return JSON.parse(transactionData as string) as DualWriteTransaction;
    } catch (error) {
      console.error('[DualWriteRoleUpdate] Failed to get operation status:', error);
      return null;
    }
  }

  /**
   * Batch role update with conflict detection
   */
  async executeBatchRoleUpdate(
    requests: AtomicRoleUpdateRequest[],
    initiatedBy: string,
    initiatedByEmail: string,
    continueOnError = false,
  ): Promise<{
    success: boolean;
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    results: Array<{
      userId: string;
      success: boolean;
      error?: string;
      result?: AtomicRoleUpdateResponse;
    }>;
    totalLatency: number;
  }> {
    const startTime = Date.now();
    const results = [];
    let successfulOperations = 0;
    let failedOperations = 0;

    // Check for batch conflicts first
    const userVersionPairs = requests.map((req) => ({
      userId: req.userId,
      expectedVersion: req.expectedVersion,
    }));

    const conflictCheck = await this.atomicService.checkBatchConflicts(userVersionPairs);

    if (conflictCheck.data?.hasConflicts) {
      if (!continueOnError) {
        throw new AtomicOperationError(
          'Batch conflict detected',
          AtomicOperationError.CODES.VERSION_CONFLICT,
          {
            retryable: true,
            details: { conflicts: conflictCheck.data.conflicts },
          },
        );
      }
    }

    // Execute operations
    for (const request of requests) {
      try {
        const result = await this.executeRoleUpdate(request, initiatedBy, initiatedByEmail);
        results.push({
          userId: request.userId,
          success: true,
          result,
        });
        successfulOperations++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          userId: request.userId,
          success: false,
          error: errorMessage,
        });
        failedOperations++;

        if (!continueOnError) {
          break;
        }
      }
    }

    const totalLatency = Date.now() - startTime;

    return {
      success: failedOperations === 0,
      totalOperations: requests.length,
      successfulOperations,
      failedOperations,
      results,
      totalLatency,
    };
  }

  /**
   * Log audit entry to Redis
   */
  private async logAuditEntry(entry: AtomicAuditLogEntry): Promise<void> {
    try {
      const auditKey = 'atomic:audit:log';
      await redisCircuitBreaker.execute(() => this.redis.lpush(auditKey, JSON.stringify(entry)));

      // Trim audit log to keep only recent entries
      await redisCircuitBreaker.execute(
        () => this.redis.ltrim(auditKey, 0, 999), // Keep last 1000 entries
      );

      // Set TTL for audit log
      await redisCircuitBreaker.execute(() => this.redis.expire(auditKey, ATOMIC_TTL.AUDIT_LOG));
    } catch (error) {
      console.error('[DualWriteRoleUpdate] Audit logging failed:', error);
    }
  }

  /**
   * Get audit log entries
   */
  async getAuditLog(
    limit = 100,
    offset = 0,
    userId?: string,
    operationType?: AtomicOperationType,
  ): Promise<AtomicAuditLogEntry[]> {
    try {
      const auditKey = 'atomic:audit:log';
      const entries = await this.redis.lrange(auditKey, offset, offset + limit - 1);

      let auditEntries = entries.map((entry) => JSON.parse(entry as string) as AtomicAuditLogEntry);

      // Filter if needed
      if (userId) {
        auditEntries = auditEntries.filter(
          (entry) => entry.userId === userId || entry.targetUserId === userId,
        );
      }

      if (operationType) {
        auditEntries = auditEntries.filter((entry) => entry.operationType === operationType);
      }

      return auditEntries;
    } catch (error) {
      console.error('[DualWriteRoleUpdate] Failed to get audit log:', error);
      return [];
    }
  }

  /**
   * Get operation metrics
   */
  async getOperationMetrics(operationType: AtomicOperationType): Promise<{
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageLatency: number;
    successRate: number;
    lastUpdated: number;
  }> {
    try {
      const metricsKey = `atomic:metrics:${operationType}`;
      const metricsData = await this.redis.get(metricsKey);

      if (!metricsData) {
        return {
          totalOperations: 0,
          successfulOperations: 0,
          failedOperations: 0,
          averageLatency: 0,
          successRate: 0,
          lastUpdated: Date.now(),
        };
      }

      const metrics = JSON.parse(metricsData as string);

      const totalOperations = metrics.totalRequests || 0;
      const successfulOperations = metrics.totalSuccesses || 0;
      const failedOperations = metrics.totalFailures || 0;
      const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;

      return {
        totalOperations,
        successfulOperations,
        failedOperations,
        averageLatency: metrics.averageLatency || 0,
        successRate,
        lastUpdated: metrics.lastUpdated || Date.now(),
      };
    } catch (error) {
      console.error('[DualWriteRoleUpdate] Failed to get metrics:', error);
      return {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageLatency: 0,
        successRate: 0,
        lastUpdated: Date.now(),
      };
    }
  }
}

// Export singleton instance
let dualWriteService: DualWriteRoleUpdateService | null = null;

export function getDualWriteRoleUpdateService(redis: Redis): DualWriteRoleUpdateService {
  if (!dualWriteService) {
    dualWriteService = new DualWriteRoleUpdateService(redis);
  }
  return dualWriteService;
}
