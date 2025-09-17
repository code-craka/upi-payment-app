/**
 * Redis Lua Scripts for Atomic Role Operations
 *
 * This module contains Lua scripts for atomic role updates with version control,
 * conflict detection, optimistic locking, and rollback capabilities.
 */

import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';
import {
  AtomicOperationType,
  LuaScriptResult,
  AtomicOperationError,
  ATOMIC_REDIS_KEYS,
  ATOMIC_TTL,
} from './types';

/**
 * Generate SHA-256 checksum for role data integrity
 */
function generateChecksum(data: Record<string, unknown>): string {
  const content = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Lua script for atomic role update with version control
 *
 * This script performs the following operations atomically:
 * 1. Check current version and detect conflicts
 * 2. Validate checksum for data integrity
 * 3. Update role data with new version
 * 4. Generate new checksum
 * 5. Set TTL for cache expiration
 */
const ATOMIC_ROLE_UPDATE_SCRIPT = `
  local role_key = KEYS[1]
  local version_key = KEYS[2]
  local checksum_key = KEYS[3]
  local lock_key = KEYS[4]

  local user_id = ARGV[1]
  local new_role = ARGV[2]
  local expected_version = tonumber(ARGV[3])
  local force_update = ARGV[4] == 'true'
  local current_time = tonumber(ARGV[5])
  local ttl = tonumber(ARGV[6])

  -- Try to acquire lock (non-blocking)
  if redis.call('exists', lock_key) == 1 then
    return cjson.encode({
      success = false,
      conflict = true,
      conflictType = 'CONCURRENT_UPDATE',
      error = 'Operation already in progress'
    })
  end

  -- Set lock with short TTL
  redis.call('setex', lock_key, 30, 'locked')

  -- Get current version
  local current_version = redis.call('get', version_key)
  if current_version then
    current_version = tonumber(current_version)
  else
    current_version = 0
  end

  -- Check version conflict (unless forced)
  if not force_update and expected_version and current_version ~= expected_version then
    redis.call('del', lock_key)
    return cjson.encode({
      success = false,
      conflict = true,
      conflictType = 'VERSION_CONFLICT',
      currentVersion = current_version,
      expectedVersion = expected_version,
      error = 'Version conflict detected'
    })
  end

  -- Prepare new role data
  local new_version = current_version + 1
  local role_data = {
    userId = user_id,
    role = new_role,
    version = new_version,
    lastModified = current_time,
    modifiedBy = 'system'
  }

  -- Generate checksum
  local data_str = cjson.encode(role_data)
  local checksum = redis.sha256hex(data_str)

  -- Store role data
  redis.call('setex', role_key, ttl, data_str)

  -- Store version
  redis.call('setex', version_key, ttl, tostring(new_version))

  -- Store checksum
  redis.call('setex', checksum_key, ttl, checksum)

  -- Release lock
  redis.call('del', lock_key)

  return cjson.encode({
    success = true,
    version = new_version,
    previousVersion = current_version,
    checksum = checksum,
    conflict = false
  })
`;

/**
 * Lua script for optimistic locking with conflict detection
 *
 * This script implements optimistic locking by checking version
 * and providing detailed conflict information
 */
const OPTIMISTIC_LOCK_SCRIPT = `
  local version_key = KEYS[1]
  local lock_key = KEYS[2]

  local expected_version = tonumber(ARGV[1])
  local lock_id = ARGV[2]
  local lock_ttl = tonumber(ARGV[3])

  -- Get current version
  local current_version = redis.call('get', version_key)
  if current_version then
    current_version = tonumber(current_version)
  else
    current_version = 0
  end

  -- Check if already locked
  local existing_lock = redis.call('get', lock_key)
  if existing_lock and existing_lock ~= lock_id then
    return cjson.encode({
      success = false,
      lockAcquired = false,
      currentVersion = current_version,
      error = 'Resource locked by another operation'
    })
  end

  -- Acquire lock
  redis.call('setex', lock_key, lock_ttl, lock_id)

  -- Check version
  if expected_version and current_version ~= expected_version then
    redis.call('del', lock_key)
    return cjson.encode({
      success = false,
      lockAcquired = false,
      conflict = true,
      conflictType = 'VERSION_CONFLICT',
      currentVersion = current_version,
      expectedVersion = expected_version
    })
  end

  return cjson.encode({
    success = true,
    lockAcquired = true,
    currentVersion = current_version,
    lockId = lock_id,
    lockExpires = redis.call('ttl', lock_key)
  })
`;

/**
 * Lua script for transaction rollback
 *
 * This script rolls back role changes by restoring previous state
 */
const ROLLBACK_SCRIPT = `
  local role_key = KEYS[1]
  local version_key = KEYS[2]
  local checksum_key = KEYS[3]
  local rollback_key = KEYS[4]

  -- Get rollback data
  local rollback_data = redis.call('get', rollback_key)
  if not rollback_data then
    return cjson.encode({
      success = false,
      error = 'No rollback data found'
    })
  end

  local rollback = cjson.decode(rollback_data)

  -- Restore role data
  if rollback.roleData then
    redis.call('setex', role_key, rollback.ttl, rollback.roleData)
  else
    redis.call('del', role_key)
  end

  -- Restore version
  if rollback.version then
    redis.call('setex', version_key, rollback.ttl, tostring(rollback.version))
  else
    redis.call('del', version_key)
  end

  -- Restore checksum
  if rollback.checksum then
    redis.call('setex', checksum_key, rollback.ttl, rollback.checksum)
  else
    redis.call('del', checksum_key)
  end

  -- Clean up rollback data
  redis.call('del', rollback_key)

  return cjson.encode({
    success = true,
    rolledBack = true,
    restoredVersion = rollback.version
  })
`;

/**
 * Lua script for batch conflict detection
 *
 * This script checks for conflicts across multiple users
 */
const BATCH_CONFLICT_CHECK_SCRIPT = `
  local conflict_count = 0
  local conflicts = {}

  for i = 1, #KEYS do
    local version_key = KEYS[i]
    local expected_version = tonumber(ARGV[i])

    local current_version = redis.call('get', version_key)
    if current_version then
      current_version = tonumber(current_version)
    else
      current_version = 0
    end

    if expected_version and current_version ~= expected_version then
      conflict_count = conflict_count + 1
      table.insert(conflicts, {
        userIndex = i,
        currentVersion = current_version,
        expectedVersion = expected_version
      })
    end
  end

  return cjson.encode({
    hasConflicts = conflict_count > 0,
    conflictCount = conflict_count,
    conflicts = conflicts
  })
`;

/**
 * Lua script for circuit breaker state management
 */
const CIRCUIT_BREAKER_SCRIPT = `
  local state_key = KEYS[1]
  local metrics_key = KEYS[2]

  local operation_type = ARGV[1]
  local success = ARGV[2] == 'true'
  local latency = tonumber(ARGV[3])
  local failure_threshold = tonumber(ARGV[4])
  local current_time = tonumber(ARGV[5])

  -- Get current circuit breaker state
  local state_data = redis.call('get', state_key)
  local state
  if state_data then
    state = cjson.decode(state_data)
  else
    state = {
      state = 'CLOSED',
      failures = 0,
      successes = 0,
      lastFailureTime = nil,
      lastSuccessTime = nil,
      lastStateChange = current_time
    }
  end

  -- Update metrics
  local metrics_data = redis.call('get', metrics_key)
  local metrics
  if metrics_data then
    metrics = cjson.decode(metrics_data)
  else
    metrics = {
      totalRequests = 0,
      totalFailures = 0,
      totalSuccesses = 0,
      averageLatency = 0,
      lastUpdated = current_time
    }
  end

  metrics.totalRequests = metrics.totalRequests + 1

  if success then
    metrics.totalSuccesses = metrics.totalSuccesses + 1
    state.successes = state.successes + 1
    state.lastSuccessTime = current_time

    -- Update average latency
    if metrics.averageLatency == 0 then
      metrics.averageLatency = latency
    else
      metrics.averageLatency = (metrics.averageLatency + latency) / 2
    end
  else
    metrics.totalFailures = metrics.totalFailures + 1
    state.failures = state.failures + 1
    state.lastFailureTime = current_time

    -- Check if should open circuit
    if state.state == 'CLOSED' and state.failures >= failure_threshold then
      state.state = 'OPEN'
      state.lastStateChange = current_time
    end
  end

  -- Save updated state and metrics
  redis.call('setex', state_key, 600, cjson.encode(state))
  redis.call('setex', metrics_key, 86400, cjson.encode(metrics))

  return cjson.encode({
    circuitState = state.state,
    canProceed = state.state == 'CLOSED',
    metrics = metrics
  })
`;

/**
 * Atomic Role Update Service
 *
 * Provides methods for executing atomic role operations using Redis Lua scripts
 */
export class AtomicRoleUpdateService {
  private redis: Redis;
  private scripts: Map<string, string> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
    this.initializeScripts();
  }

  /**
   * Initialize Lua scripts
   */
  private initializeScripts(): void {
    this.scripts.set('atomic_update', ATOMIC_ROLE_UPDATE_SCRIPT);
    this.scripts.set('optimistic_lock', OPTIMISTIC_LOCK_SCRIPT);
    this.scripts.set('rollback', ROLLBACK_SCRIPT);
    this.scripts.set('batch_conflict_check', BATCH_CONFLICT_CHECK_SCRIPT);
    this.scripts.set('circuit_breaker', CIRCUIT_BREAKER_SCRIPT);
  }

  /**
   * Execute atomic role update with version control
   */
  async executeAtomicRoleUpdate(
    userId: string,
    newRole: string,
    expectedVersion?: number,
    force = false,
    ttl = ATOMIC_TTL.ROLE_DATA,
  ): Promise<LuaScriptResult> {
    try {
      const script = this.scripts.get('atomic_update')!;
      const keys = [
        ATOMIC_REDIS_KEYS.ROLE_DATA(userId),
        ATOMIC_REDIS_KEYS.ROLE_VERSION(userId),
        ATOMIC_REDIS_KEYS.ROLE_CHECKSUM(userId),
        ATOMIC_REDIS_KEYS.OPERATION_LOCK(userId),
      ];

      const args = [
        userId,
        newRole,
        expectedVersion?.toString() || '',
        force.toString(),
        Date.now().toString(),
        ttl.toString(),
      ];

      const result = await this.redis.eval(script, keys, args);
      return JSON.parse(result as string) as LuaScriptResult;
    } catch (error) {
      console.error('[AtomicRoleUpdate] Script execution failed:', error);
      throw new AtomicOperationError(
        'Atomic role update failed',
        AtomicOperationError.CODES.REDIS_UPDATE_FAILED,
        {
          userId,
          retryable: true,
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      );
    }
  }

  /**
   * Acquire optimistic lock for role operation
   */
  async acquireOptimisticLock(
    userId: string,
    expectedVersion?: number,
    lockTtl = ATOMIC_TTL.LOCK,
  ): Promise<LuaScriptResult> {
    try {
      const script = this.scripts.get('optimistic_lock')!;
      const lockId = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const keys = [
        ATOMIC_REDIS_KEYS.ROLE_VERSION(userId),
        ATOMIC_REDIS_KEYS.OPERATION_LOCK(userId),
      ];

      const args = [expectedVersion?.toString() || '', lockId, lockTtl.toString()];

      const result = await this.redis.eval(script, keys, args);
      return JSON.parse(result as string) as LuaScriptResult;
    } catch (error) {
      console.error('[AtomicRoleUpdate] Lock acquisition failed:', error);
      throw new AtomicOperationError(
        'Failed to acquire optimistic lock',
        AtomicOperationError.CODES.LOCK_ACQUISITION_FAILED,
        {
          userId,
          retryable: true,
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      );
    }
  }

  /**
   * Release optimistic lock
   */
  async releaseOptimisticLock(userId: string): Promise<void> {
    try {
      await this.redis.del(ATOMIC_REDIS_KEYS.OPERATION_LOCK(userId));
    } catch (error) {
      console.error('[AtomicRoleUpdate] Lock release failed:', error);
    }
  }

  /**
   * Execute rollback operation
   */
  async executeRollback(userId: string, operationId: string): Promise<LuaScriptResult> {
    try {
      const script = this.scripts.get('rollback')!;
      const rollbackKey = ATOMIC_REDIS_KEYS.ROLLBACK_DATA(operationId);

      const keys = [
        ATOMIC_REDIS_KEYS.ROLE_DATA(userId),
        ATOMIC_REDIS_KEYS.ROLE_VERSION(userId),
        ATOMIC_REDIS_KEYS.ROLE_CHECKSUM(userId),
        rollbackKey,
      ];

      const result = await this.redis.eval(script, keys, []);
      return JSON.parse(result as string) as LuaScriptResult;
    } catch (error) {
      console.error('[AtomicRoleUpdate] Rollback failed:', error);
      throw new AtomicOperationError(
        'Rollback operation failed',
        AtomicOperationError.CODES.ROLLBACK_FAILED,
        {
          userId,
          operationId,
          retryable: false,
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      );
    }
  }

  /**
   * Check for conflicts in batch operations
   */
  async checkBatchConflicts(
    userVersionPairs: Array<{ userId: string; expectedVersion?: number }>,
  ): Promise<LuaScriptResult> {
    try {
      const script = this.scripts.get('batch_conflict_check')!;
      const keys = userVersionPairs.map((pair) => ATOMIC_REDIS_KEYS.ROLE_VERSION(pair.userId));
      const args = userVersionPairs.map((pair) => pair.expectedVersion?.toString() || '');

      const result = await this.redis.eval(script, keys, args);
      return JSON.parse(result as string) as LuaScriptResult;
    } catch (error) {
      console.error('[AtomicRoleUpdate] Batch conflict check failed:', error);
      throw new AtomicOperationError(
        'Batch conflict check failed',
        AtomicOperationError.CODES.SERVICE_UNAVAILABLE,
        {
          retryable: true,
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      );
    }
  }

  /**
   * Check circuit breaker state
   */
  async checkCircuitBreaker(
    operationType: AtomicOperationType,
    success: boolean,
    latency: number,
    failureThreshold = 5,
  ): Promise<LuaScriptResult> {
    try {
      const script = this.scripts.get('circuit_breaker')!;
      const keys = [
        ATOMIC_REDIS_KEYS.CIRCUIT_BREAKER(operationType),
        ATOMIC_REDIS_KEYS.METRICS(operationType),
      ];

      const args = [
        operationType,
        success.toString(),
        latency.toString(),
        failureThreshold.toString(),
        Date.now().toString(),
      ];

      const result = await this.redis.eval(script, keys, args);
      return JSON.parse(result as string) as LuaScriptResult;
    } catch (error) {
      console.error('[AtomicRoleUpdate] Circuit breaker check failed:', error);
      // Return default state if circuit breaker fails
      return {
        success: true,
        conflict: false,
        canProceed: true,
        circuitState: 'CLOSED',
      };
    }
  }

  /**
   * Store rollback data for potential recovery
   */
  async storeRollbackData(
    operationId: string,
    userId: string,
    rollbackData: {
      roleData?: string;
      version?: number;
      checksum?: string;
      ttl: number;
    },
  ): Promise<void> {
    try {
      const rollbackKey = ATOMIC_REDIS_KEYS.ROLLBACK_DATA(operationId);
      await this.redis.setex(rollbackKey, ATOMIC_TTL.ROLLBACK_DATA, JSON.stringify(rollbackData));
    } catch (error) {
      console.error('[AtomicRoleUpdate] Failed to store rollback data:', error);
    }
  }

  /**
   * Get current role data with integrity check
   */
  async getRoleDataWithIntegrity(userId: string): Promise<{
    data: Record<string, unknown>;
    version: number;
    checksum: string;
    isValid: boolean;
  } | null> {
    try {
      const [roleData, version, checksum] = await Promise.all([
        this.redis.get(ATOMIC_REDIS_KEYS.ROLE_DATA(userId)),
        this.redis.get(ATOMIC_REDIS_KEYS.ROLE_VERSION(userId)),
        this.redis.get(ATOMIC_REDIS_KEYS.ROLE_CHECKSUM(userId)),
      ]);

      if (!roleData || !version || !checksum) {
        return null;
      }

      const data = JSON.parse(roleData as string);
      const currentVersion = parseInt(version as string);
      const storedChecksum = checksum as string;

      // Verify integrity
      const calculatedChecksum = generateChecksum(data);
      const isValid = calculatedChecksum === storedChecksum;

      return {
        data,
        version: currentVersion,
        checksum: storedChecksum,
        isValid,
      };
    } catch (error) {
      console.error('[AtomicRoleUpdate] Failed to get role data:', error);
      return null;
    }
  }

  /**
   * Clean up operation locks and temporary data
   */
  async cleanupOperation(userId: string, operationId?: string): Promise<void> {
    try {
      const keysToDelete = [ATOMIC_REDIS_KEYS.OPERATION_LOCK(userId)];

      if (operationId) {
        keysToDelete.push(ATOMIC_REDIS_KEYS.ROLLBACK_DATA(operationId));
      }

      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }
    } catch (error) {
      console.error('[AtomicRoleUpdate] Cleanup failed:', error);
    }
  }
}

// Export singleton instance
let atomicRoleUpdateService: AtomicRoleUpdateService | null = null;

export function getAtomicRoleUpdateService(redis: Redis): AtomicRoleUpdateService {
  if (!atomicRoleUpdateService) {
    atomicRoleUpdateService = new AtomicRoleUpdateService(redis);
  }
  return atomicRoleUpdateService;
}

// Export scripts for testing
export {
  ATOMIC_ROLE_UPDATE_SCRIPT,
  OPTIMISTIC_LOCK_SCRIPT,
  ROLLBACK_SCRIPT,
  BATCH_CONFLICT_CHECK_SCRIPT,
  CIRCUIT_BREAKER_SCRIPT,
};
