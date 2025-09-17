/**
 * Graceful Degradation Timeout Configuration
 *
 * Centralized timeout configuration for all services with environment-based
 * settings and operation-specific performance budgets.
 */

export interface ServiceTimeouts {
  /** Fast operations (cache reads, simple queries) */
  fast: number;
  /** Standard operations (auth checks, basic database operations) */
  standard: number;
  /** Slow operations (complex queries, file operations) */
  slow: number;
  /** Emergency timeout (absolute maximum wait time) */
  emergency: number;
}

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time to wait before attempting half-open state (ms) */
  recoveryTimeout: number;
  /** Time window for counting failures (ms) */
  monitoringWindow: number;
  /** Percentage of requests to allow in half-open state */
  halfOpenMaxRequests: number;
}

export interface TimeoutConfig {
  redis: ServiceTimeouts;
  clerk: ServiceTimeouts;
  database: ServiceTimeouts;
  webhook: ServiceTimeouts;
  circuitBreaker: CircuitBreakerConfig;
  /** Global timeout for any operation */
  globalTimeout: number;
  /** Performance budget thresholds */
  performanceBudget: {
    /** P95 response time threshold (ms) */
    p95Threshold: number;
    /** P99 response time threshold (ms) */
    p99Threshold: number;
    /** Error rate threshold (0.0-1.0) */
    errorRateThreshold: number;
  };
}

/**
 * Default timeout configuration with production-ready values
 */
const DEFAULT_TIMEOUTS: TimeoutConfig = {
  redis: {
    fast: 50, // Cache reads
    standard: 200, // Role lookups, simple operations
    slow: 1000, // Complex operations
    emergency: 3000, // Absolute maximum
  },
  clerk: {
    fast: 500, // Simple auth checks
    standard: 2000, // User data fetching
    slow: 5000, // Complex operations
    emergency: 10000, // Absolute maximum
  },
  database: {
    fast: 100, // Simple queries
    standard: 1000, // Standard operations
    slow: 5000, // Complex queries
    emergency: 15000, // Absolute maximum
  },
  webhook: {
    fast: 1000, // Simple webhooks
    standard: 3000, // Standard processing
    slow: 10000, // Complex processing
    emergency: 30000, // Absolute maximum
  },
  circuitBreaker: {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    monitoringWindow: 300000, // 5 minutes
    halfOpenMaxRequests: 3,
  },
  globalTimeout: 30000, // 30 seconds
  performanceBudget: {
    p95Threshold: 500, // 500ms P95
    p99Threshold: 2000, // 2s P99
    errorRateThreshold: 0.05, // 5% error rate
  },
};

/**
 * Environment-based timeout configuration
 */
function getEnvironmentTimeouts(): Partial<TimeoutConfig> {
  const env = process.env.NODE_ENV || 'development';

  // Development - more lenient timeouts for debugging
  if (env === 'development') {
    return {
      redis: {
        fast: 100,
        standard: 500,
        slow: 2000,
        emergency: 5000,
      },
      clerk: {
        fast: 1000,
        standard: 3000,
        slow: 8000,
        emergency: 15000,
      },
      globalTimeout: 45000,
    };
  }

  // Production - strict timeouts for performance
  if (env === 'production') {
    return {
      redis: {
        fast: 30, // Very fast cache reads
        standard: 150, // Quick role lookups
        slow: 800, // Complex operations
        emergency: 2000,
      },
      clerk: {
        fast: 300,
        standard: 1500,
        slow: 4000,
        emergency: 8000,
      },
      performanceBudget: {
        p95Threshold: 300,
        p99Threshold: 1000,
        errorRateThreshold: 0.02, // 2% error rate in production
      },
    };
  }

  // Test environment - very fast timeouts
  if (env === 'test') {
    return {
      redis: { fast: 10, standard: 50, slow: 200, emergency: 500 },
      clerk: { fast: 100, standard: 500, slow: 1000, emergency: 2000 },
      database: { fast: 50, standard: 200, slow: 1000, emergency: 3000 },
      globalTimeout: 10000,
    };
  }

  return {};
}

/**
 * Custom timeout overrides from environment variables
 */
function getEnvironmentOverrides(): Partial<TimeoutConfig> {
  const overrides: Partial<TimeoutConfig> = {};

  // Redis timeouts
  if (process.env.REDIS_TIMEOUT_FAST) {
    overrides.redis = {
      ...DEFAULT_TIMEOUTS.redis,
      fast: parseInt(process.env.REDIS_TIMEOUT_FAST),
    };
  }

  if (process.env.REDIS_TIMEOUT_STANDARD) {
    overrides.redis = {
      ...overrides.redis,
      ...DEFAULT_TIMEOUTS.redis,
      standard: parseInt(process.env.REDIS_TIMEOUT_STANDARD),
    };
  }

  if (process.env.REDIS_TIMEOUT_SLOW) {
    overrides.redis = {
      ...overrides.redis,
      ...DEFAULT_TIMEOUTS.redis,
      slow: parseInt(process.env.REDIS_TIMEOUT_SLOW),
    };
  }

  // Clerk timeouts
  if (process.env.CLERK_TIMEOUT_FAST) {
    overrides.clerk = {
      ...DEFAULT_TIMEOUTS.clerk,
      fast: parseInt(process.env.CLERK_TIMEOUT_FAST),
    };
  }

  if (process.env.CLERK_TIMEOUT_STANDARD) {
    overrides.clerk = {
      ...overrides.clerk,
      ...DEFAULT_TIMEOUTS.clerk,
      standard: parseInt(process.env.CLERK_TIMEOUT_STANDARD),
    };
  }

  // Global timeout
  if (process.env.GLOBAL_TIMEOUT) {
    overrides.globalTimeout = parseInt(process.env.GLOBAL_TIMEOUT);
  }

  // Performance budget
  if (process.env.PERFORMANCE_P95_THRESHOLD) {
    overrides.performanceBudget = {
      ...DEFAULT_TIMEOUTS.performanceBudget,
      p95Threshold: parseInt(process.env.PERFORMANCE_P95_THRESHOLD),
    };
  }

  if (process.env.ERROR_RATE_THRESHOLD) {
    overrides.performanceBudget = {
      ...overrides.performanceBudget,
      ...DEFAULT_TIMEOUTS.performanceBudget,
      errorRateThreshold: parseFloat(process.env.ERROR_RATE_THRESHOLD),
    };
  }

  return overrides;
}

/**
 * Deep merge timeout configurations
 */
function mergeTimeoutConfigs(
  base: TimeoutConfig,
  ...overrides: Partial<TimeoutConfig>[]
): TimeoutConfig {
  const result = { ...base };

  for (const override of overrides) {
    if (override.redis) {
      result.redis = { ...result.redis, ...override.redis };
    }
    if (override.clerk) {
      result.clerk = { ...result.clerk, ...override.clerk };
    }
    if (override.database) {
      result.database = { ...result.database, ...override.database };
    }
    if (override.webhook) {
      result.webhook = { ...result.webhook, ...override.webhook };
    }
    if (override.circuitBreaker) {
      result.circuitBreaker = { ...result.circuitBreaker, ...override.circuitBreaker };
    }
    if (override.performanceBudget) {
      result.performanceBudget = {
        ...result.performanceBudget,
        ...override.performanceBudget,
      };
    }
    if (override.globalTimeout !== undefined) {
      result.globalTimeout = override.globalTimeout;
    }
  }

  return result;
}

/**
 * Get the current timeout configuration
 * Merges defaults with environment-specific settings and overrides
 */
export function getTimeoutConfig(): TimeoutConfig {
  return mergeTimeoutConfigs(DEFAULT_TIMEOUTS, getEnvironmentTimeouts(), getEnvironmentOverrides());
}

/**
 * Operation type mapping for timeout selection
 */
export type OperationType = 'fast' | 'standard' | 'slow' | 'emergency';

export interface OperationConfig {
  type: OperationType;
  service: keyof Omit<TimeoutConfig, 'circuitBreaker' | 'globalTimeout' | 'performanceBudget'>;
  description?: string;
}

/**
 * Predefined operation configurations
 */
export const OPERATION_CONFIGS = {
  // Redis operations
  REDIS_GET: { type: 'fast' as OperationType, service: 'redis' as const },
  REDIS_SET: { type: 'fast' as OperationType, service: 'redis' as const },
  REDIS_DEL: { type: 'fast' as OperationType, service: 'redis' as const },
  REDIS_PING: { type: 'fast' as OperationType, service: 'redis' as const },
  REDIS_SCRIPT: { type: 'standard' as OperationType, service: 'redis' as const },
  REDIS_COMPLEX: { type: 'slow' as OperationType, service: 'redis' as const },

  // Clerk operations
  CLERK_AUTH_CHECK: { type: 'fast' as OperationType, service: 'clerk' as const },
  CLERK_USER_FETCH: { type: 'standard' as OperationType, service: 'clerk' as const },
  CLERK_USER_UPDATE: { type: 'standard' as OperationType, service: 'clerk' as const },
  CLERK_WEBHOOK_VERIFY: { type: 'fast' as OperationType, service: 'clerk' as const },
  CLERK_COMPLEX: { type: 'slow' as OperationType, service: 'clerk' as const },

  // Database operations
  DB_FIND_ONE: { type: 'fast' as OperationType, service: 'database' as const },
  DB_FIND_MANY: { type: 'standard' as OperationType, service: 'database' as const },
  DB_CREATE: { type: 'standard' as OperationType, service: 'database' as const },
  DB_UPDATE: { type: 'standard' as OperationType, service: 'database' as const },
  DB_DELETE: { type: 'standard' as OperationType, service: 'database' as const },
  DB_AGGREGATE: { type: 'slow' as OperationType, service: 'database' as const },
  DB_TRANSACTION: { type: 'slow' as OperationType, service: 'database' as const },

  // Webhook operations
  WEBHOOK_SIMPLE: { type: 'fast' as OperationType, service: 'webhook' as const },
  WEBHOOK_PROCESS: { type: 'standard' as OperationType, service: 'webhook' as const },
  WEBHOOK_COMPLEX: { type: 'slow' as OperationType, service: 'webhook' as const },
} as const;

/**
 * Get timeout for specific operation
 */
export function getOperationTimeout(operationConfig: OperationConfig): number {
  const config = getTimeoutConfig();
  const serviceTimeouts = config[operationConfig.service] as ServiceTimeouts;
  return serviceTimeouts[operationConfig.type];
}

/**
 * Validate timeout configuration
 */
export function validateTimeoutConfig(config: TimeoutConfig): string[] {
  const errors: string[] = [];

  // Validate that timeouts are in ascending order
  for (const [serviceName, timeouts] of Object.entries(config)) {
    if (typeof timeouts === 'object' && 'fast' in timeouts) {
      const { fast, standard, slow, emergency } = timeouts as ServiceTimeouts;

      if (fast >= standard) {
        errors.push(
          `${serviceName}: fast timeout (${fast}) must be less than standard (${standard})`,
        );
      }
      if (standard >= slow) {
        errors.push(
          `${serviceName}: standard timeout (${standard}) must be less than slow (${slow})`,
        );
      }
      if (slow >= emergency) {
        errors.push(
          `${serviceName}: slow timeout (${slow}) must be less than emergency (${emergency})`,
        );
      }

      // Validate minimum values
      if (fast < 10) {
        errors.push(`${serviceName}: fast timeout (${fast}) is too low (minimum 10ms)`);
      }
      if (emergency > config.globalTimeout) {
        errors.push(
          `${serviceName}: emergency timeout (${emergency}) exceeds global timeout (${config.globalTimeout})`,
        );
      }
    }
  }

  // Validate performance budget
  const { p95Threshold, p99Threshold, errorRateThreshold } = config.performanceBudget;

  if (p95Threshold >= p99Threshold) {
    errors.push(
      `P95 threshold (${p95Threshold}) must be less than P99 threshold (${p99Threshold})`,
    );
  }

  if (errorRateThreshold < 0 || errorRateThreshold > 1) {
    errors.push(`Error rate threshold (${errorRateThreshold}) must be between 0.0 and 1.0`);
  }

  return errors;
}

/**
 * Log timeout configuration for debugging
 */
export function logTimeoutConfig(): void {
  const config = getTimeoutConfig();
  const validationErrors = validateTimeoutConfig(config);

  if (validationErrors.length > 0) {
    console.error('Timeout configuration validation failed:', validationErrors);
    throw new Error(`Invalid timeout configuration: ${validationErrors.join(', ')}`);
  }

  console.log('Timeout configuration loaded:', {
    environment: process.env.NODE_ENV,
    redis: config.redis,
    clerk: config.clerk,
    database: config.database,
    performanceBudget: config.performanceBudget,
    globalTimeout: config.globalTimeout,
  });
}
