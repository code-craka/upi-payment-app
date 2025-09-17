/**
 * Promise.race Timeout Wrappers
 * 
 * Utility functions that wrap async operations with timeout handling using Promise.race.
 * Provides clean timeout patterns with proper cleanup and error handling.
 */

import { gracefulDegradation, type GracefulDegradationOptions } from './graceful-degradation-service';
import { OPERATION_CONFIGS, type OperationConfig } from './timeout-config';
import { TimeoutError } from './graceful-degradation-service';

/**
 * Options for timeout wrapper
 */
export interface TimeoutWrapperOptions {
  /** Custom timeout in milliseconds (overrides operation config) */
  timeoutMs?: number;
  /** Operation configuration for timeout selection */
  operationConfig?: OperationConfig;
  /** Enable cleanup function on timeout */
  cleanup?: () => void | Promise<void>;
  /** Custom timeout error message */
  timeoutMessage?: string;
  /** Enable graceful degradation */
  enableGracefulDegradation?: boolean;
  /** Graceful degradation options */
  gracefulOptions?: Partial<GracefulDegradationOptions>;
}

/**
 * Wrap a promise with timeout using Promise.race
 * Basic timeout wrapper without graceful degradation
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutWrapperOptions
): Promise<T> {
  const timeoutMs = options.timeoutMs || 5000; // Default 5s timeout
  let timeoutId: NodeJS.Timeout | undefined;
  let cleanupExecuted = false;
  
  const performCleanup = async () => {
    if (!cleanupExecuted && options.cleanup) {
      cleanupExecuted = true;
      try {
        await options.cleanup();
      } catch (cleanupError) {
        console.warn('Cleanup function failed:', cleanupError);
      }
    }
  };
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(async () => {
      await performCleanup();
      
      const error = options.operationConfig
        ? new TimeoutError(
            options.timeoutMessage || `Operation timed out after ${timeoutMs}ms`,
            options.operationConfig,
            timeoutMs
          )
        : new Error(options.timeoutMessage || `Operation timed out after ${timeoutMs}ms`);
      
      reject(error);
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    await performCleanup();
    throw error;
  }
}

/**
 * Wrap a promise with timeout and graceful degradation
 */
export async function withTimeoutAndDegradation<T>(
  operation: () => Promise<T>,
  options: TimeoutWrapperOptions
): Promise<T> {
  if (!options.enableGracefulDegradation) {
    return withTimeout(operation(), options);
  }
  
  const operationConfig = options.operationConfig || OPERATION_CONFIGS.REDIS_GET;
  
  const gracefulOptions: GracefulDegradationOptions = {
    operationConfig,
    enableCircuitBreaker: true,
    retryOnTimeout: false,
    maxRetries: 0,
    ...options.gracefulOptions
  };
  
  return gracefulDegradation.executeWithDegradation(operation, {
    ...gracefulOptions,
    fallbackStrategies: gracefulOptions.fallbackStrategies as any
  });
}

/**
 * Timeout wrapper specifically for Redis operations
 */
export async function withRedisTimeout<T>(
  operation: () => Promise<T>,
  operationType: keyof typeof OPERATION_CONFIGS = 'REDIS_GET'
): Promise<T> {
  const operationConfig = OPERATION_CONFIGS[operationType];
  
  return withTimeoutAndDegradation(operation, {
    operationConfig,
    enableGracefulDegradation: true,
    timeoutMessage: `Redis ${operationType} operation timed out`,
    cleanup: async () => {
      // Redis cleanup - could close connections, cancel operations, etc.
      console.warn(`Redis operation ${operationType} timed out - performing cleanup`);
    }
  });
}

/**
 * Timeout wrapper specifically for Clerk operations
 */
export async function withClerkTimeout<T>(
  operation: () => Promise<T>,
  operationType: keyof Pick<typeof OPERATION_CONFIGS, 'CLERK_AUTH_CHECK' | 'CLERK_USER_FETCH' | 'CLERK_USER_UPDATE' | 'CLERK_WEBHOOK_VERIFY' | 'CLERK_COMPLEX'> = 'CLERK_AUTH_CHECK'
): Promise<T> {
  const operationConfig = OPERATION_CONFIGS[operationType];
  
  return withTimeoutAndDegradation(operation, {
    operationConfig,
    enableGracefulDegradation: true,
    timeoutMessage: `Clerk ${operationType} operation timed out`,
    cleanup: async () => {
      console.warn(`Clerk operation ${operationType} timed out - performing cleanup`);
    }
  });
}

/**
 * Timeout wrapper specifically for database operations
 */
export async function withDatabaseTimeout<T>(
  operation: () => Promise<T>,
  operationType: keyof Pick<typeof OPERATION_CONFIGS, 'DB_FIND_ONE' | 'DB_FIND_MANY' | 'DB_CREATE' | 'DB_UPDATE' | 'DB_DELETE' | 'DB_AGGREGATE' | 'DB_TRANSACTION'> = 'DB_FIND_ONE'
): Promise<T> {
  const operationConfig = OPERATION_CONFIGS[operationType];
  
  return withTimeoutAndDegradation(operation, {
    operationConfig,
    enableGracefulDegradation: true,
    timeoutMessage: `Database ${operationType} operation timed out`,
    cleanup: async () => {
      // Database cleanup - could close connections, rollback transactions, etc.
      console.warn(`Database operation ${operationType} timed out - performing cleanup`);
    }
  });
}

/**
 * Timeout wrapper for webhook operations
 */
export async function withWebhookTimeout<T>(
  operation: () => Promise<T>,
  operationType: keyof Pick<typeof OPERATION_CONFIGS, 'WEBHOOK_SIMPLE' | 'WEBHOOK_PROCESS' | 'WEBHOOK_COMPLEX'> = 'WEBHOOK_SIMPLE'
): Promise<T> {
  const operationConfig = OPERATION_CONFIGS[operationType];
  
  return withTimeoutAndDegradation(operation, {
    operationConfig,
    enableGracefulDegradation: true,
    timeoutMessage: `Webhook ${operationType} operation timed out`,
    cleanup: async () => {
      console.warn(`Webhook operation ${operationType} timed out - performing cleanup`);
    }
  });
}

/**
 * Race multiple promises with individual timeouts
 * Useful for trying multiple services with different timeout budgets
 */
export async function raceWithTimeouts<T>(
  operations: Array<{
    operation: () => Promise<T>;
    options: TimeoutWrapperOptions;
    priority: number; // Lower number = higher priority for logging
  }>
): Promise<T> {
  if (operations.length === 0) {
    throw new Error('No operations provided to race');
  }
  
  // Sort by priority for result preference
  const sortedOperations = operations.sort((a, b) => a.priority - b.priority);
  
  // Create promises with timeouts
  const promisesWithTimeouts = sortedOperations.map((op, index) => {
    const wrappedPromise = withTimeoutAndDegradation(op.operation, {
      ...op.options,
      enableGracefulDegradation: true
    });
    
    // Add metadata to track which operation succeeded
    return wrappedPromise.then(
      (result) => ({ result, operationIndex: index, error: null }),
      (error) => ({ result: null, operationIndex: index, error })
    );
  });
  
  try {
    // Wait for first successful result
    const results = await Promise.allSettled(promisesWithTimeouts);
    
    // Find first successful result (by priority order)
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled' && result.value.error === null) {
        console.log(`Race winner: operation ${index} (priority ${sortedOperations[index].priority})`);
        return result.value.result as T;
      }
    }
    
    // If no operation succeeded, throw the error from highest priority operation
    const firstError = results[0].status === 'fulfilled' 
      ? (results[0].value as { error: Error }).error 
      : results[0].reason;
    
    throw firstError || new Error('All operations in race failed');
    
  } catch (error) {
    console.error('All operations in race failed:', error);
    throw error;
  }
}

/**
 * Timeout with exponential backoff retry
 */
export async function withTimeoutAndRetry<T>(
  operation: () => Promise<T>,
  options: TimeoutWrapperOptions & {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryCondition?: (error: unknown) => boolean;
  }
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const baseDelayMs = options.baseDelayMs || 100;
  const maxDelayMs = options.maxDelayMs || 5000;
  const backoffMultiplier = options.backoffMultiplier || 2;
  const retryCondition = options.retryCondition || ((error: unknown) => {
    // Default: retry on timeout or network errors
    if (error instanceof TimeoutError) return true;
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('network') || message.includes('connection') || message.includes('timeout');
    }
    return false;
  });
  
  let lastError: unknown;
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      return await withTimeoutAndDegradation(operation, options);
    } catch (error) {
      lastError = error;
      
      // Don't retry if we've exhausted attempts or error is not retryable
      if (attempt >= maxRetries || !retryCondition(error)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delayMs = Math.min(
        baseDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );
      
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, error);
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
      attempt++;
    }
  }
  
  throw lastError;
}

/**
 * Helper to create timeout with AbortController for better cleanup
 */
export function createTimeoutWithAbortController(
  timeoutMs: number
): { timeoutPromise: Promise<never>; abortController: AbortController } {
  const abortController = new AbortController();
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      abortController.abort();
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // Clean up timeout if aborted elsewhere
    abortController.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
    });
  });
  
  return { timeoutPromise, abortController };
}

/**
 * Wrap fetch with timeout and abort controller
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const timeoutMs = init.timeoutMs || 10000; // Default 10s for HTTP requests
  const { timeoutPromise, abortController } = createTimeoutWithAbortController(timeoutMs);
  
  const requestInit: RequestInit = {
    ...init,
    signal: abortController.signal
  };
  
  delete (requestInit as unknown as { timeoutMs?: number }).timeoutMs;
  
  try {
    const response = await Promise.race([
      fetch(input, requestInit),
      timeoutPromise
    ]);
    
    return response;
  } catch (error) {
    abortController.abort(); // Ensure cleanup
    throw error;
  }
}

/**
 * Utility to check if error is a timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Utility to extract timeout information from error
 */
export function getTimeoutInfo(error: unknown): {
  isTimeout: boolean;
  timeoutMs?: number;
  operationConfig?: OperationConfig;
  timestamp?: Date;
} {
  if (error instanceof TimeoutError) {
    return {
      isTimeout: true,
      timeoutMs: error.timeoutMs,
      operationConfig: error.operationConfig,
      timestamp: error.timestamp
    };
  }
  
  // Check for other timeout-like errors
  if (error instanceof Error && error.message.toLowerCase().includes('timeout')) {
    return { isTimeout: true };
  }
  
  return { isTimeout: false };
}