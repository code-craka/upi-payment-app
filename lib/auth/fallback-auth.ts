import { currentUser } from '@clerk/nextjs/server';
import {
  getSession,
  hasRole as redisHasRole,
  hasPermission as redisHasPermission,
} from '@/lib/session/redis';
import { serverLogger } from '@/lib/utils/server-logger';
import { getPermissionsForRole } from '@/lib/types/roles';
import type { UserRole } from '@/lib/types';

export interface FallbackSessionData {
  userId: string;
  role: UserRole | null;
  permissions: string[];
  source: 'redis' | 'clerk' | 'none';
  updatedAt: Date | null;
  hasSession: boolean;
  redisAvailable: boolean;
}

/**
 * Get user session with automatic Clerk fallback when Redis is unavailable
 * This ensures the system continues working even during Redis outages
 *
 * @param userId - User ID
 * @param refreshTTL - Whether to refresh Redis TTL on access
 * @returns Session data from Redis or Clerk fallback
 */
export async function getSessionWithFallback(
  userId: string,
  refreshTTL = false,
): Promise<FallbackSessionData> {
  try {
    // Try Redis first
    const redisSession = await getSession(userId, refreshTTL);

    if (redisSession) {
      return {
        userId,
        role: redisSession.role,
        permissions: redisSession.permissions || [],
        source: 'redis',
        updatedAt: redisSession.updatedAt,
        hasSession: true,
        redisAvailable: true,
      };
    }

    // Redis returned null - could be no session or Redis unavailable
    // Try Clerk as fallback
    const user = await currentUser();
    if (!user || user.id !== userId) {
      return {
        userId,
        role: null,
        permissions: [],
        source: 'none',
        updatedAt: null,
        hasSession: false,
        redisAvailable: false,
      };
    }

    const clerkRole = (user.publicMetadata as { role?: string })?.role;
    if (!clerkRole) {
      serverLogger.info('No session in Redis and no role in Clerk', { userId });
      return {
        userId,
        role: null,
        permissions: [],
        source: 'none',
        updatedAt: null,
        hasSession: false,
        redisAvailable: false,
      };
    }

    // Valid role found in Clerk - use as fallback
    const validRoles = ['admin', 'merchant', 'viewer'];
    if (!validRoles.includes(clerkRole)) {
      serverLogger.warn('Invalid role found in Clerk metadata', {
        userId,
        clerkRole,
      });
      return {
        userId,
        role: null,
        permissions: [],
        source: 'none',
        updatedAt: null,
        hasSession: false,
        redisAvailable: false,
      };
    }

    const permissions = Array.from(getPermissionsForRole(clerkRole as UserRole));

    serverLogger.info('Using Clerk fallback for user session', {
      userId,
      clerkRole,
      permissionCount: permissions.length,
      reason: 'Redis session not found',
    });

    return {
      userId,
      role: clerkRole as UserRole,
      permissions,
      source: 'clerk',
      updatedAt: new Date(user.updatedAt || user.createdAt),
      hasSession: true,
      redisAvailable: false,
    };
  } catch (error) {
    serverLogger.error('Failed to get session with fallback', error, { userId });
    return {
      userId,
      role: null,
      permissions: [],
      source: 'none',
      updatedAt: null,
      hasSession: false,
      redisAvailable: false,
    };
  }
}

/**
 * Check if user has required role with automatic Clerk fallback
 *
 * @param userId - User ID
 * @param requiredRole - Required role
 * @returns Whether user has required role
 */
export async function hasRoleWithFallback(
  userId: string,
  requiredRole: UserRole,
): Promise<boolean> {
  try {
    // Try Redis first
    const redisResult = await redisHasRole(userId, requiredRole);

    // If Redis check was successful (true/false), use that result
    const redisSession = await getSession(userId);
    if (redisSession) {
      return redisResult;
    }

    // Redis unavailable or no session - use Clerk fallback
    const fallbackSession = await getSessionWithFallback(userId);

    if (!fallbackSession.hasSession) {
      return false;
    }

    // Admin has access to everything
    if (fallbackSession.role === 'admin') {
      return true;
    }

    const hasRole = fallbackSession.role === requiredRole;

    if (fallbackSession.source === 'clerk') {
      serverLogger.debug('Role check using Clerk fallback', {
        userId,
        requiredRole,
        userRole: fallbackSession.role,
        hasRole,
      });
    }

    return hasRole;
  } catch (error) {
    serverLogger.error('Failed to check role with fallback', error, {
      userId,
      requiredRole,
    });
    return false;
  }
}

/**
 * Check if user has required permission with automatic Clerk fallback
 *
 * @param userId - User ID
 * @param requiredPermission - Required permission
 * @returns Whether user has required permission
 */
export async function hasPermissionWithFallback(
  userId: string,
  requiredPermission: string,
): Promise<boolean> {
  try {
    // Try Redis first
    const redisResult = await redisHasPermission(userId, requiredPermission);

    // If Redis check was successful, use that result
    const redisSession = await getSession(userId);
    if (redisSession) {
      return redisResult;
    }

    // Redis unavailable or no session - use Clerk fallback
    const fallbackSession = await getSessionWithFallback(userId);

    if (!fallbackSession.hasSession) {
      return false;
    }

    // Admin has all permissions
    if (fallbackSession.role === 'admin') {
      return true;
    }

    const hasPermission = fallbackSession.permissions.includes(requiredPermission);

    if (fallbackSession.source === 'clerk') {
      serverLogger.debug('Permission check using Clerk fallback', {
        userId,
        requiredPermission,
        userRole: fallbackSession.role,
        userPermissions: fallbackSession.permissions.slice(0, 5), // Log first 5 permissions
        hasPermission,
      });
    }

    return hasPermission;
  } catch (error) {
    serverLogger.error('Failed to check permission with fallback', error, {
      userId,
      requiredPermission,
    });
    return false;
  }
}

/**
 * Utility to check Redis availability
 * @returns Whether Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    await getSession('test-availability-check');
    return true; // If no error thrown, Redis is available
  } catch {
    return false;
  }
}

/**
 * Higher-order function to wrap any Redis operation with Clerk fallback
 *
 * @param redisOperation - Redis operation to try
 * @param clerkFallback - Clerk fallback operation
 * @param operationName - Name for logging
 * @returns Result from Redis or Clerk fallback
 */
export async function withClerkFallback<T>(
  redisOperation: () => Promise<T>,
  clerkFallback: () => Promise<T>,
  operationName: string,
): Promise<T> {
  try {
    return await redisOperation();
  } catch (error) {
    serverLogger.warn(`Redis operation failed, using Clerk fallback`, {
      operationName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    try {
      return await clerkFallback();
    } catch (fallbackError) {
      serverLogger.error(`Both Redis and Clerk fallback failed`, {
        operationName,
        redisError: error instanceof Error ? error.message : 'Unknown error',
        clerkError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
      });
      throw fallbackError;
    }
  }
}
