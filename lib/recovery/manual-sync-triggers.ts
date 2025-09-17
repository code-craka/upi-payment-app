/**
 * Manual Sync Trigger System
 *
 * Comprehensive data consistency management system with manual triggers,
 * conflict resolution, validation, and automated sync monitoring.
 */

import { redis } from '@/lib/redis';
import { createClerkClient } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db/connection';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

// Circuit breaker class for Redis operations
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private isOpen = false;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.isOpen = false;
        this.failures = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.threshold) {
        this.isOpen = true;
      }

      throw error;
    }
  }
}

const circuitBreaker = new CircuitBreaker();

// Mock models for demonstration
const UserModel = {
  findById: async (id: string) => ({ _id: id, role: 'user' }),
  findByIdAndUpdate: async (id: string, update: any) => ({ _id: id, ...update }),
};

const AuditLogModel = {
  create: async (data: any) => ({ _id: 'audit_' + Date.now(), ...data }),
};

export interface SyncOperation {
  id: string;
  type: 'user_role_sync' | 'metadata_sync' | 'permission_sync' | 'full_sync';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'conflict_detected';
  initiatedBy: string;
  targetUserId?: string; // For user-specific sync
  batchSize?: number; // For batch operations
  startTime?: number;
  completionTime?: number;
  progress?: {
    processed: number;
    total: number;
    errors: number;
    conflicts: number;
  };
  conflicts: SyncConflict[];
  errors: SyncError[];
  result?: SyncResult;
}

export interface SyncConflict {
  id: string;
  type: 'role_mismatch' | 'metadata_conflict' | 'version_conflict' | 'permission_drift';
  userId: string;
  clerkData: Record<string, unknown>;
  redisData: Record<string, unknown>;
  mongoData?: Record<string, unknown>;
  detectedAt: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolutionStrategy?: 'clerk_wins' | 'redis_wins' | 'mongo_wins' | 'manual' | 'merge';
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface SyncError {
  id: string;
  operation: string;
  userId?: string;
  error: string;
  stackTrace?: string;
  recoverable: boolean;
  timestamp: number;
}

export interface SyncResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  conflicts: number;
  duration: number;
  performanceMetrics: {
    avgProcessingTime: number;
    throughput: number; // operations per second
    errorRate: number;
  };
  recommendations: string[];
}

export interface SyncValidationRule {
  field: string;
  source: 'clerk' | 'redis' | 'mongo';
  validator: (value: unknown) => boolean;
  priority: number; // Higher number = higher priority in conflicts
}

export interface SyncConfiguration {
  batchSize: number;
  timeoutMs: number;
  retryAttempts: number;
  conflictResolutionStrategy: 'auto' | 'manual' | 'priority_based';
  validationRules: SyncValidationRule[];
  notifications: {
    onConflict: boolean;
    onCompletion: boolean;
    onError: boolean;
  };
}

class ManualSyncTriggerSystem {
  private static instance: ManualSyncTriggerSystem;
  private activeSyncs: Map<string, SyncOperation> = new Map();
  private syncQueue: string[] = [];
  private isProcessing = false;
  private syncTimer?: ReturnType<typeof setTimeout>;

  private defaultConfig: SyncConfiguration = {
    batchSize: 50,
    timeoutMs: 300000, // 5 minutes
    retryAttempts: 3,
    conflictResolutionStrategy: 'priority_based',
    validationRules: [
      {
        field: 'role',
        source: 'clerk',
        validator: (value: unknown) =>
          typeof value === 'string' && ['admin', 'manager', 'user'].includes(value as string),
        priority: 3,
      },
      {
        field: 'role',
        source: 'redis',
        validator: (value: unknown) => typeof value === 'string',
        priority: 2,
      },
      {
        field: 'role',
        source: 'mongo',
        validator: (value: unknown) => typeof value === 'string',
        priority: 1,
      },
    ],
    notifications: {
      onConflict: true,
      onCompletion: true,
      onError: true,
    },
  };

  private constructor() {
    this.startSyncProcessor();
  }

  public static getInstance(): ManualSyncTriggerSystem {
    if (!ManualSyncTriggerSystem.instance) {
      ManualSyncTriggerSystem.instance = new ManualSyncTriggerSystem();
    }
    return ManualSyncTriggerSystem.instance;
  }

  /**
   * Trigger manual sync operation
   */
  public async triggerSync(
    type: SyncOperation['type'],
    initiatedBy: string,
    targetUserId?: string,
    config?: Partial<SyncConfiguration>,
  ): Promise<SyncOperation> {
    const syncConfig = { ...this.defaultConfig, ...config };

    const operation: SyncOperation = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: 'pending',
      initiatedBy,
      targetUserId,
      batchSize: syncConfig.batchSize,
      conflicts: [],
      errors: [],
      progress: { processed: 0, total: 0, errors: 0, conflicts: 0 },
    };

    // Store operation
    this.activeSyncs.set(operation.id, operation);
    await this.persistSyncOperation(operation);

    // Add to queue
    this.syncQueue.push(operation.id);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processSyncQueue();
    }

    // Audit log
    await this.logSyncEvent('sync_triggered', {
      syncId: operation.id,
      type: operation.type,
      initiatedBy,
      targetUserId,
    });

    return operation;
  }

  /**
   * Process sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.isProcessing || this.syncQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.syncQueue.length > 0) {
        const syncId = this.syncQueue.shift()!;
        const operation = this.activeSyncs.get(syncId);

        if (!operation || operation.status !== 'pending') {
          continue;
        }

        await this.executeSyncOperation(operation);
      }
    } catch (error) {
      console.error('Sync queue processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute sync operation
   */
  private async executeSyncOperation(operation: SyncOperation): Promise<void> {
    operation.status = 'running';
    operation.startTime = Date.now();

    try {
      switch (operation.type) {
        case 'user_role_sync':
          await this.executeUserRoleSync(operation);
          break;
        case 'metadata_sync':
          await this.executeMetadataSync(operation);
          break;
        case 'permission_sync':
          await this.executePermissionSync(operation);
          break;
        case 'full_sync':
          await this.executeFullSync(operation);
          break;
      }

      // Complete operation
      operation.completionTime = Date.now();
      operation.status = operation.conflicts.length > 0 ? 'conflict_detected' : 'completed';

      // Generate result summary
      operation.result = this.generateSyncResult(operation);

      // Send completion notification
      if (this.defaultConfig.notifications.onCompletion) {
        await this.sendSyncNotification('completion', operation);
      }
    } catch (error) {
      operation.status = 'failed';
      operation.errors.push({
        id: `error_${Date.now()}`,
        operation: 'sync_execution',
        error: error instanceof Error ? error.message : 'Unknown error',
        stackTrace: error instanceof Error ? error.stack : undefined,
        recoverable: false,
        timestamp: Date.now(),
      });

      if (this.defaultConfig.notifications.onError) {
        await this.sendSyncNotification('error', operation);
      }
    }

    // Update storage
    await this.persistSyncOperation(operation);

    // Audit log
    await this.logSyncEvent('sync_completed', {
      syncId: operation.id,
      status: operation.status,
      duration: operation.completionTime! - operation.startTime!,
      conflicts: operation.conflicts.length,
      errors: operation.errors.length,
    });
  }

  /**
   * Execute user role sync
   */
  private async executeUserRoleSync(operation: SyncOperation): Promise<void> {
    let users: { userId: string; [key: string]: unknown }[];

    if (operation.targetUserId) {
      // Single user sync
      users = [{ userId: operation.targetUserId }];
    } else {
      // Get all users from Clerk
      const clerkUsers = await clerkClient.users.getUserList({ limit: 1000 });
      users = clerkUsers.data.map((user: any) => ({ userId: user.id }));
    }

    operation.progress!.total = users.length;

    for (const user of users) {
      try {
        await this.syncUserRole(user.userId, operation);
        operation.progress!.processed++;
      } catch (error) {
        operation.progress!.errors++;
        operation.errors.push({
          id: `error_${Date.now()}`,
          operation: 'user_role_sync',
          userId: user.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          recoverable: true,
          timestamp: Date.now(),
        });
      }

      // Batch processing delay
      if (operation.progress!.processed % (operation.batchSize || 50) === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Sync individual user role
   */
  private async syncUserRole(userId: string, operation: SyncOperation): Promise<void> {
    // Get data from all sources
    const [clerkData, redisData, mongoData] = await Promise.allSettled([
      this.getClerkUserData(userId),
      this.getRedisUserData(userId),
      this.getMongoUserData(userId),
    ]);

    const sources = {
      clerk: clerkData.status === 'fulfilled' ? clerkData.value : null,
      redis: redisData.status === 'fulfilled' ? redisData.value : null,
      mongo: mongoData.status === 'fulfilled' ? mongoData.value : null,
    };

    // Validate data consistency
    const conflict = this.detectConflict(userId, sources);
    if (conflict) {
      operation.conflicts.push(conflict);
      operation.progress!.conflicts++;

      if (this.defaultConfig.notifications.onConflict) {
        await this.sendSyncNotification('conflict', operation, conflict);
      }

      // Attempt automatic resolution
      if (this.defaultConfig.conflictResolutionStrategy !== 'manual') {
        await this.resolveConflict(conflict, operation);
      }
    } else {
      // Ensure all sources are synchronized
      await this.ensureConsistency(userId, sources);
    }
  }

  /**
   * Detect conflicts between data sources
   */
  private detectConflict(
    userId: string,
    sources: {
      clerk: Record<string, unknown> | null;
      redis: Record<string, unknown> | null;
      mongo: Record<string, unknown> | null;
    },
  ): SyncConflict | null {
    const values = {
      clerk: sources.clerk?.role,
      redis: sources.redis?.role,
      mongo: sources.mongo?.role,
    };

    // Check for role conflicts
    const uniqueRoles = new Set(Object.values(values).filter(Boolean));
    if (uniqueRoles.size > 1) {
      return {
        id: `conflict_${Date.now()}_${userId}`,
        type: 'role_mismatch',
        userId,
        clerkData: sources.clerk || {},
        redisData: sources.redis || {},
        mongoData: sources.mongo || {},
        detectedAt: Date.now(),
        severity: this.calculateConflictSeverity(values),
        resolutionStrategy: this.determineResolutionStrategy(values),
      };
    }

    return null;
  }

  /**
   * Calculate conflict severity
   */
  private calculateConflictSeverity(values: Record<string, unknown>): SyncConflict['severity'] {
    const hasAdminConflict = Object.values(values).some((v) => v === 'admin');
    const hasNullConflict = Object.values(values).some((v) => !v);

    if (hasAdminConflict) return 'critical';
    if (hasNullConflict) return 'high';
    return 'medium';
  }

  /**
   * Determine automatic resolution strategy
   */
  private determineResolutionStrategy(
    values: Record<string, unknown>,
  ): SyncConflict['resolutionStrategy'] {
    if (this.defaultConfig.conflictResolutionStrategy === 'manual') {
      return 'manual';
    }

    // Priority-based resolution (Clerk > Redis > Mongo)
    if (values.clerk) return 'clerk_wins';
    if (values.redis) return 'redis_wins';
    if (values.mongo) return 'mongo_wins';

    return 'manual';
  }

  /**
   * Resolve conflict automatically
   */
  private async resolveConflict(conflict: SyncConflict, operation: SyncOperation): Promise<void> {
    if (!conflict.resolutionStrategy || conflict.resolutionStrategy === 'manual') {
      return;
    }

    try {
      let authoritative: Record<string, unknown>;
      let authSource: string;

      switch (conflict.resolutionStrategy) {
        case 'clerk_wins':
          authoritative = conflict.clerkData;
          authSource = 'clerk';
          break;
        case 'redis_wins':
          authoritative = conflict.redisData;
          authSource = 'redis';
          break;
        case 'mongo_wins':
          authoritative = conflict.mongoData || {};
          authSource = 'mongo';
          break;
        default:
          return;
      }

      // Apply resolution
      await this.applySyncResolution(conflict.userId, authoritative, authSource);

      conflict.resolvedAt = Date.now();
      conflict.resolvedBy = 'system';

      await this.logSyncEvent('conflict_resolved', {
        conflictId: conflict.id,
        userId: conflict.userId,
        strategy: conflict.resolutionStrategy,
        authSource,
      });
    } catch (error) {
      operation.errors.push({
        id: `error_${Date.now()}`,
        operation: 'conflict_resolution',
        userId: conflict.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        recoverable: true,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Apply sync resolution across all sources
   */
  private async applySyncResolution(
    userId: string,
    authoritative: Record<string, unknown>,
    authSource: string,
  ): Promise<void> {
    const role = authoritative.role as string;
    if (!role) return;

    const operations = [];

    // Update Clerk if not the source
    if (authSource !== 'clerk') {
      operations.push(
        circuitBreaker.execute(() =>
          clerkClient.users.updateUser(userId, {
            publicMetadata: { role },
          }),
        ),
      );
    }

    // Update Redis if not the source
    if (authSource !== 'redis') {
      operations.push(circuitBreaker.execute(() => redis.setex(`role:${userId}`, 30, role)));
    }

    // Update MongoDB if not the source
    if (authSource !== 'mongo') {
      operations.push(connectDB().then(() => UserModel.findByIdAndUpdate(userId, { role })));
    }

    await Promise.allSettled(operations);
  }

  /**
   * Ensure consistency across all sources
   */
  private async ensureConsistency(
    userId: string,
    sources: {
      clerk: Record<string, unknown> | null;
      redis: Record<string, unknown> | null;
      mongo: Record<string, unknown> | null;
    },
  ): Promise<void> {
    const role = sources.clerk?.role || sources.redis?.role || sources.mongo?.role;
    if (!role) return;

    const updates = [];

    // Ensure Redis has the role
    if (!sources.redis?.role) {
      updates.push(circuitBreaker.execute(() => redis.setex(`role:${userId}`, 30, role as string)));
    }

    // Ensure MongoDB has the role
    if (!sources.mongo?.role) {
      updates.push(connectDB().then(() => UserModel.findByIdAndUpdate(userId, { role })));
    }

    await Promise.allSettled(updates);
  }

  /**
   * Execute metadata sync (similar structure to role sync)
   */
  private async executeMetadataSync(operation: SyncOperation): Promise<void> {
    // Implementation similar to role sync but for metadata fields
    console.log('Metadata sync not yet implemented');
  }

  /**
   * Execute permission sync
   */
  private async executePermissionSync(operation: SyncOperation): Promise<void> {
    // Implementation for permission synchronization
    console.log('Permission sync not yet implemented');
  }

  /**
   * Execute full sync (combines all sync types)
   */
  private async executeFullSync(operation: SyncOperation): Promise<void> {
    await this.executeUserRoleSync(operation);
    await this.executeMetadataSync(operation);
    await this.executePermissionSync(operation);
  }

  /**
   * Get user data from various sources
   */
  private async getClerkUserData(userId: string): Promise<Record<string, unknown>> {
    try {
      const user = await clerkClient.users.getUser(userId);
      return {
        role: user.publicMetadata?.role,
        email: user.emailAddresses[0]?.emailAddress,
        lastSignIn: user.lastSignInAt,
        ...user.publicMetadata,
      };
    } catch (error) {
      throw new Error(
        `Failed to get Clerk data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async getRedisUserData(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const role = await redis.get(`role:${userId}`);
      return role ? { role } : null;
    } catch (error) {
      return null;
    }
  }

  private async getMongoUserData(userId: string): Promise<Record<string, unknown> | null> {
    try {
      await connectDB();
      const user = await UserModel.findById(userId);
      return user ? { role: (user as any).role } : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate sync result summary
   */
  private generateSyncResult(operation: SyncOperation): SyncResult {
    const duration = (operation.completionTime || Date.now()) - (operation.startTime || 0);
    const processed = operation.progress?.processed || 0;
    const errors = operation.progress?.errors || 0;
    const conflicts = operation.progress?.conflicts || 0;

    return {
      totalProcessed: processed,
      successful: processed - errors,
      failed: errors,
      conflicts,
      duration,
      performanceMetrics: {
        avgProcessingTime: processed > 0 ? duration / processed : 0,
        throughput: duration > 0 ? (processed / duration) * 1000 : 0,
        errorRate: processed > 0 ? errors / processed : 0,
      },
      recommendations: this.generateRecommendations(operation),
    };
  }

  /**
   * Generate recommendations based on sync results
   */
  private generateRecommendations(operation: SyncOperation): string[] {
    const recommendations: string[] = [];
    const errors = operation.progress?.errors || 0;
    const processed = operation.progress?.processed || 0;
    const errorRate = processed > 0 ? errors / processed : 0;

    if (errorRate > 0.1) {
      recommendations.push('High error rate detected. Check system connectivity and permissions.');
    }

    if (operation.conflicts.length > 0) {
      recommendations.push(
        `${operation.conflicts.length} conflicts detected. Review conflict resolution strategy.`,
      );
    }

    const result = operation.result;
    if (result && result.performanceMetrics.throughput < 10) {
      recommendations.push(
        'Low throughput detected. Consider increasing batch size or optimizing network connectivity.',
      );
    }

    return recommendations;
  }

  /**
   * Manual conflict resolution
   */
  public async resolveConflictManually(
    conflictId: string,
    resolutionStrategy: SyncConflict['resolutionStrategy'],
    resolvedBy: string,
  ): Promise<boolean> {
    try {
      // Find conflict across all operations
      let targetConflict: SyncConflict | null = null;
      let targetOperation: SyncOperation | null = null;

      for (const operation of this.activeSyncs.values()) {
        const conflict = operation.conflicts.find((c) => c.id === conflictId);
        if (conflict) {
          targetConflict = conflict;
          targetOperation = operation;
          break;
        }
      }

      if (!targetConflict || !targetOperation) {
        return false;
      }

      // Update resolution strategy
      targetConflict.resolutionStrategy = resolutionStrategy;
      targetConflict.resolvedBy = resolvedBy;

      // Execute resolution
      await this.resolveConflict(targetConflict, targetOperation);

      // Update operation
      await this.persistSyncOperation(targetOperation);

      return true;
    } catch (error) {
      console.error('Manual conflict resolution failed:', error);
      return false;
    }
  }

  /**
   * Get sync operation status
   */
  public getSyncOperation(syncId: string): SyncOperation | undefined {
    return this.activeSyncs.get(syncId);
  }

  /**
   * Get all active sync operations
   */
  public getActiveSyncOperations(): SyncOperation[] {
    return Array.from(this.activeSyncs.values());
  }

  /**
   * Get sync statistics
   */
  public async getSyncStatistics(timeframe: number = 86400000): Promise<{
    totalSyncs: number;
    successful: number;
    failed: number;
    conflictsDetected: number;
    avgDuration: number;
  }> {
    const cutoff = Date.now() - timeframe;
    const operations = Array.from(this.activeSyncs.values()).filter(
      (op) => (op.startTime || 0) > cutoff,
    );

    const successful = operations.filter((op) => op.status === 'completed').length;
    const failed = operations.filter((op) => op.status === 'failed').length;
    const conflictsDetected = operations.reduce((sum, op) => sum + op.conflicts.length, 0);

    const completedOps = operations.filter((op) => op.completionTime);
    const avgDuration =
      completedOps.length > 0
        ? completedOps.reduce(
            (sum, op) => sum + ((op.completionTime || 0) - (op.startTime || 0)),
            0,
          ) / completedOps.length
        : 0;

    return {
      totalSyncs: operations.length,
      successful,
      failed,
      conflictsDetected,
      avgDuration,
    };
  }

  /**
   * Start periodic sync processor
   */
  private startSyncProcessor(): void {
    this.syncTimer = setInterval(() => {
      if (!this.isProcessing && this.syncQueue.length > 0) {
        this.processSyncQueue();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Utility methods
   */
  private async sendSyncNotification(
    type: 'completion' | 'error' | 'conflict',
    operation: SyncOperation,
    conflict?: SyncConflict,
  ): Promise<void> {
    console.log(`SYNC NOTIFICATION [${type}]:`, {
      syncId: operation.id,
      type: operation.type,
      status: operation.status,
      conflict: conflict?.id,
      duration: operation.completionTime
        ? operation.completionTime - (operation.startTime || 0)
        : undefined,
    });
  }

  private async persistSyncOperation(operation: SyncOperation): Promise<void> {
    try {
      await redis.setex(
        `sync_operation:${operation.id}`,
        86400 * 7, // 7 days
        JSON.stringify(operation),
      );
    } catch (error) {
      console.error('Failed to persist sync operation:', error);
    }
  }

  private async logSyncEvent(event: string, data: Record<string, unknown>): Promise<void> {
    try {
      await connectDB();
      await AuditLogModel.create({
        action: event,
        entityType: 'SyncOperation',
        entityId: data.syncId as string,
        userId: (data.initiatedBy as string) || 'system',
        metadata: data,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to log sync event:', error);
    }
  }

  /**
   * Cleanup old operations
   */
  public cleanup(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
  }
}

// Export singleton instance
export const manualSyncTriggerSystem = ManualSyncTriggerSystem.getInstance();

// Convenience functions
export const triggerUserRoleSync = (initiatedBy: string, targetUserId?: string) =>
  manualSyncTriggerSystem.triggerSync('user_role_sync', initiatedBy, targetUserId);

export const triggerFullSync = (initiatedBy: string) =>
  manualSyncTriggerSystem.triggerSync('full_sync', initiatedBy);

export const resolveConflictManually = (
  conflictId: string,
  strategy: SyncConflict['resolutionStrategy'],
  resolvedBy: string,
) => manualSyncTriggerSystem.resolveConflictManually(conflictId, strategy, resolvedBy);
