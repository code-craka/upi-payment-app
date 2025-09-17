/**
 * Atomic Role Update Types and Interfaces
 *
 * This module defines the types and interfaces for atomic role updates
 * with version control, conflict resolution, and comprehensive audit logging.
 */

import { z } from "zod"
import { UserRoleSchema } from "../types"

// Import UserRole type from existing types
export type UserRole = z.infer<typeof UserRoleSchema>

// ==========================================
// ATOMIC ROLE UPDATE TYPES
// ==========================================

// Atomic Operation Types
export enum AtomicOperationType {
  ROLE_UPDATE = 'role_update',
  ROLE_ASSIGN = 'role_assign',
  ROLE_REVOKE = 'role_revoke',
  ROLE_SYNC = 'role_sync',
  ROLE_ROLLBACK = 'role_rollback'
}

// Version Control Schema
export const VersionControlSchema = z.object({
  version: z.number().min(0),
  previousVersion: z.number().min(0).nullable(),
  lastModified: z.number(),
  modifiedBy: z.string(),
  checksum: z.string(), // SHA-256 hash of role data
})

export type VersionControl = z.infer<typeof VersionControlSchema>

// Atomic Role Update Request
export const AtomicRoleUpdateRequestSchema = z.object({
  userId: z.string(),
  newRole: UserRoleSchema,
  expectedVersion: z.number().optional(), // For optimistic locking
  reason: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  force: z.boolean().default(false), // Override version check
  timeout: z.number().default(30000), // Operation timeout in ms
})

export type AtomicRoleUpdateRequest = z.infer<typeof AtomicRoleUpdateRequestSchema>

// Atomic Role Update Response
export const AtomicRoleUpdateResponseSchema = z.object({
  success: z.boolean(),
  userId: z.string(),
  previousRole: UserRoleSchema.nullable(),
  newRole: UserRoleSchema,
  version: z.number(),
  clerkUpdated: z.boolean(),
  redisUpdated: z.boolean(),
  operationId: z.string(),
  timestamp: z.number(),
  latency: z.object({
    clerk: z.number().optional(),
    redis: z.number().optional(),
    total: z.number(),
  }),
  conflicts: z.array(z.object({
    type: z.string(),
    message: z.string(),
    resolution: z.string(),
  })).optional(),
})

export type AtomicRoleUpdateResponse = z.infer<typeof AtomicRoleUpdateResponseSchema>

// Conflict Resolution Types
export enum ConflictType {
  VERSION_MISMATCH = 'version_mismatch',
  CONCURRENT_UPDATE = 'concurrent_update',
  STALE_DATA = 'stale_data',
  NETWORK_ERROR = 'network_error',
  SERVICE_UNAVAILABLE = 'service_unavailable'
}

export const ConflictResolutionSchema = z.object({
  type: z.nativeEnum(ConflictType),
  message: z.string(),
  resolution: z.enum(['retry', 'force', 'rollback', 'abort']),
  retryAfter: z.number().optional(),
  suggestedAction: z.string().optional(),
})

export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>

// Rollback Context
export const RollbackContextSchema = z.object({
  operationId: z.string(),
  userId: z.string(),
  originalRole: UserRoleSchema.nullable(),
  targetRole: UserRoleSchema,
  clerkState: z.object({
    updated: z.boolean(),
    originalMetadata: z.record(z.any()).optional(),
  }),
  redisState: z.object({
    updated: z.boolean(),
    originalData: z.record(z.any()).optional(),
  }),
  timestamp: z.number(),
})

export type RollbackContext = z.infer<typeof RollbackContextSchema>

// Atomic Operation Context
export const AtomicOperationContextSchema = z.object({
  operationId: z.string(),
  type: z.nativeEnum(AtomicOperationType),
  userId: z.string(),
  initiatedBy: z.string(),
  initiatedAt: z.number(),
  timeout: z.number(),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(3),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'rolled_back']),
  progress: z.object({
    clerkStarted: z.boolean().default(false),
    clerkCompleted: z.boolean().default(false),
    redisStarted: z.boolean().default(false),
    redisCompleted: z.boolean().default(false),
  }),
})

export type AtomicOperationContext = z.infer<typeof AtomicOperationContextSchema>

// Enhanced Audit Log Entry
export const AtomicAuditLogEntrySchema = z.object({
  id: z.string(),
  operationId: z.string(),
  operationType: z.nativeEnum(AtomicOperationType),
  userId: z.string(),
  targetUserId: z.string(),
  previousRole: UserRoleSchema.nullable(),
  newRole: UserRoleSchema,
  version: z.number(),
  initiatedBy: z.string(),
  initiatedByEmail: z.string(),
  reason: z.string().optional(),
  success: z.boolean(),
  clerkUpdated: z.boolean(),
  redisUpdated: z.boolean(),
  conflicts: z.array(ConflictResolutionSchema).optional(),
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
    stack: z.string().optional(),
  }).optional(),
  performance: z.object({
    clerkLatency: z.number().optional(),
    redisLatency: z.number().optional(),
    totalLatency: z.number(),
    retryCount: z.number().default(0),
  }),
  metadata: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: z.number(),
  completedAt: z.number().optional(),
})

export type AtomicAuditLogEntry = z.infer<typeof AtomicAuditLogEntrySchema>

// Redis Lua Script Results
export const LuaScriptResultSchema = z.object({
  success: z.boolean(),
  version: z.number().optional(),
  previousVersion: z.number().optional(),
  checksum: z.string().optional(),
  conflict: z.boolean().default(false),
  conflictType: z.nativeEnum(ConflictType).optional(),
  error: z.string().optional(),
  data: z.record(z.any()).optional(),
  // Circuit breaker specific properties
  canProceed: z.boolean().optional(),
  circuitState: z.string().optional(),
})

export type LuaScriptResult = z.infer<typeof LuaScriptResultSchema>

// Dual-Write Transaction State
export const DualWriteTransactionSchema = z.object({
  transactionId: z.string(),
  userId: z.string(),
  state: z.enum(['initiated', 'clerk_updating', 'clerk_updated', 'redis_updating', 'redis_updated', 'committed', 'failed', 'rolled_back']),
  clerkResult: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    latency: z.number().optional(),
  }).optional(),
  redisResult: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    latency: z.number().optional(),
    version: z.number().optional(),
  }).optional(),
  rollbackResult: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    latency: z.number().optional(),
  }).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  timeout: z.number(),
})

export type DualWriteTransaction = z.infer<typeof DualWriteTransactionSchema>

// Optimistic Locking Context
export const OptimisticLockContextSchema = z.object({
  userId: z.string(),
  expectedVersion: z.number(),
  currentVersion: z.number().optional(),
  lockAcquired: z.boolean(),
  lockId: z.string().optional(),
  lockExpires: z.number().optional(),
  attempts: z.number().default(0),
  maxAttempts: z.number().default(5),
})

export type OptimisticLockContext = z.infer<typeof OptimisticLockContextSchema>

// Circuit Breaker Integration
export const AtomicOperationCircuitBreakerSchema = z.object({
  operationType: z.nativeEnum(AtomicOperationType),
  enabled: z.boolean().default(true),
  failureThreshold: z.number().default(5),
  recoveryTimeout: z.number().default(30000),
  state: z.enum(['closed', 'open', 'half_open']),
  lastFailure: z.number().optional(),
  consecutiveFailures: z.number().default(0),
})

export type AtomicOperationCircuitBreaker = z.infer<typeof AtomicOperationCircuitBreakerSchema>

// Monitoring and Metrics
export const AtomicOperationMetricsSchema = z.object({
  operationType: z.nativeEnum(AtomicOperationType),
  totalOperations: z.number().default(0),
  successfulOperations: z.number().default(0),
  failedOperations: z.number().default(0),
  averageLatency: z.number().default(0),
  p95Latency: z.number().default(0),
  p99Latency: z.number().default(0),
  conflictRate: z.number().default(0),
  rollbackRate: z.number().default(0),
  lastUpdated: z.number(),
})

export type AtomicOperationMetrics = z.infer<typeof AtomicOperationMetricsSchema>

// Error Recovery Strategy
export const ErrorRecoveryStrategySchema = z.object({
  strategy: z.enum(['retry', 'rollback', 'compensate', 'abort']),
  maxRetries: z.number().default(3),
  backoffMultiplier: z.number().default(2),
  maxBackoffTime: z.number().default(30000),
  retryCondition: z.enum(['network_error', 'service_unavailable', 'version_conflict', 'any']).default('any'),
})

export type ErrorRecoveryStrategy = z.infer<typeof ErrorRecoveryStrategySchema>

// ==========================================
// UTILITY TYPES
// ==========================================

// Operation Result Union Type
export type AtomicOperationResult<T = any> =
  | { success: true; data: T; metadata?: Record<string, any> }
  | { success: false; error: string; code?: string; retryable?: boolean }

// Promise-based operation result
export type AsyncAtomicOperationResult<T = any> = Promise<AtomicOperationResult<T>>

// Batch Operation Types
export const BatchRoleUpdateRequestSchema = z.object({
  operations: z.array(AtomicRoleUpdateRequestSchema),
  continueOnError: z.boolean().default(false),
  maxConcurrency: z.number().default(5),
  timeout: z.number().default(120000), // 2 minutes
})

export type BatchRoleUpdateRequest = z.infer<typeof BatchRoleUpdateRequestSchema>

export const BatchRoleUpdateResponseSchema = z.object({
  success: z.boolean(),
  totalOperations: z.number(),
  successfulOperations: z.number(),
  failedOperations: z.number(),
  results: z.array(z.object({
    userId: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
    result: AtomicRoleUpdateResponseSchema.optional(),
  })),
  totalLatency: z.number(),
  timestamp: z.number(),
})

export type BatchRoleUpdateResponse = z.infer<typeof BatchRoleUpdateResponseSchema>

// ==========================================
// REDIS KEYS AND CONSTANTS
// ==========================================

// Redis keys for atomic operations
export const ATOMIC_REDIS_KEYS = {
  // Role data with versioning
  ROLE_DATA: (userId: string) => `atomic:role:data:${userId}`,
  ROLE_VERSION: (userId: string) => `atomic:role:version:${userId}`,
  ROLE_CHECKSUM: (userId: string) => `atomic:role:checksum:${userId}`,

  // Operation tracking
  OPERATION_CONTEXT: (operationId: string) => `atomic:operation:context:${operationId}`,
  OPERATION_LOCK: (userId: string) => `atomic:operation:lock:${userId}`,

  // Transaction management
  TRANSACTION_STATE: (transactionId: string) => `atomic:transaction:state:${transactionId}`,
  TRANSACTION_LOCK: (transactionId: string) => `atomic:transaction:lock:${transactionId}`,

  // Conflict resolution
  CONFLICT_LOG: (userId: string) => `atomic:conflict:log:${userId}`,
  VERSION_HISTORY: (userId: string) => `atomic:version:history:${userId}`,

  // Metrics and monitoring
  METRICS: (operationType: string) => `atomic:metrics:${operationType}`,
  CIRCUIT_BREAKER: (operationType: string) => `atomic:circuit:${operationType}`,

  // Audit and rollback
  AUDIT_LOG: 'atomic:audit:log',
  ROLLBACK_DATA: (operationId: string) => `atomic:rollback:data:${operationId}`,
} as const

// TTL values for different data types
export const ATOMIC_TTL = {
  ROLE_DATA: 300,        // 5 minutes (matches existing ROLE_CACHE_TTL)
  OPERATION_CONTEXT: 300, // 5 minutes
  TRANSACTION_STATE: 600, // 10 minutes
  CONFLICT_LOG: 3600,    // 1 hour
  VERSION_HISTORY: 86400, // 24 hours
  METRICS: 86400,        // 24 hours
  AUDIT_LOG: 2592000,    // 30 days
  ROLLBACK_DATA: 3600,   // 1 hour
  LOCK: 30,              // 30 seconds
} as const

// ==========================================
// ERROR TYPES
// ==========================================

export class AtomicOperationError extends Error {
  public readonly code: string
  public readonly operationId?: string
  public readonly userId?: string
  public readonly retryable: boolean
  public readonly details?: any

  constructor(
    message: string,
    code: string,
    options: {
      operationId?: string
      userId?: string
      retryable?: boolean
      details?: any
    } = {}
  ) {
    super(message)
    this.name = 'AtomicOperationError'
    this.code = code
    this.operationId = options.operationId
    this.userId = options.userId
    this.retryable = options.retryable ?? false
    this.details = options.details
  }

  static readonly CODES = {
    VERSION_CONFLICT: 'VERSION_CONFLICT',
    CONCURRENT_UPDATE: 'CONCURRENT_UPDATE',
    CLERK_UPDATE_FAILED: 'CLERK_UPDATE_FAILED',
    REDIS_UPDATE_FAILED: 'REDIS_UPDATE_FAILED',
    ROLLBACK_FAILED: 'ROLLBACK_FAILED',
    TIMEOUT: 'TIMEOUT',
    LOCK_ACQUISITION_FAILED: 'LOCK_ACQUISITION_FAILED',
    CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',
    INVALID_REQUEST: 'INVALID_REQUEST',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  } as const
}