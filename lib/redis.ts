import { Redis } from '@upstash/redis';

// Edge-safe Redis client for hybrid role management
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Redis keys for role management
export const REDIS_KEYS = {
  USER_ROLE: (userId: string) => `user:${userId}:role`,
  SESSION_SYNC: (userId: string) => `session:${userId}:sync`,
  ROLE_CACHE: (userId: string) => `role:${userId}:cache`,
  ADMIN_BOOTSTRAP: 'admin:bootstrap:status',
  ROLE_STATS: 'roles:stats',
} as const;

// Role cache TTL (30 seconds for real-time feel)
export const ROLE_CACHE_TTL = 30;

// Session data interface
export interface RedisSessionData {
  userId: string;
  role: string;
  lastSync: number;
  clerkSync: boolean;
  metadata?: Record<string, any>;
}

// Role statistics interface
export interface RoleStats {
  admin: number;
  merchant: number;
  viewer: number;
  total: number;
  lastUpdated: number;
}

/**
 * Cache user role in Redis with TTL
 * @param userId - User ID from Clerk
 * @param role - User role (admin, merchant, viewer)
 * @param metadata - Additional role metadata
 */
export async function cacheUserRole(
  userId: string, 
  role: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const sessionData: RedisSessionData = {
      userId,
      role,
      lastSync: Date.now(),
      clerkSync: true,
      metadata,
    };

    // Set user role with TTL
    await redis.setex(
      REDIS_KEYS.USER_ROLE(userId),
      ROLE_CACHE_TTL,
      JSON.stringify(sessionData)
    );

    // Update session sync timestamp
    await redis.setex(
      REDIS_KEYS.SESSION_SYNC(userId),
      ROLE_CACHE_TTL * 2, // Longer TTL for sync tracking
      Date.now().toString()
    );

    console.log(`[Redis] Cached role for user ${userId}: ${role}`);
  } catch (error) {
    console.error('[Redis] Failed to cache user role:', error);
    // Don't throw - Redis is supplementary
  }
}

/**
 * Get cached user role from Redis
 * @param userId - User ID from Clerk
 * @returns Cached role data or null if not found/expired
 */
export async function getCachedUserRole(userId: string): Promise<RedisSessionData | null> {
  try {
    const cached = await redis.get(REDIS_KEYS.USER_ROLE(userId));
    
    if (!cached) {
      return null;
    }

    const sessionData: RedisSessionData = JSON.parse(cached as string);
    
    // Verify data integrity
    if (!sessionData.userId || !sessionData.role) {
      console.warn(`[Redis] Invalid cached data for user ${userId}`);
      return null;
    }

    return sessionData;
  } catch (error) {
    console.error('[Redis] Failed to get cached role:', error);
    return null;
  }
}

/**
 * Invalidate user role cache
 * @param userId - User ID to invalidate
 */
export async function invalidateUserRole(userId: string): Promise<void> {
  try {
    await Promise.all([
      redis.del(REDIS_KEYS.USER_ROLE(userId)),
      redis.del(REDIS_KEYS.SESSION_SYNC(userId)),
      redis.del(REDIS_KEYS.ROLE_CACHE(userId)),
    ]);

    console.log(`[Redis] Invalidated role cache for user ${userId}`);
  } catch (error) {
    console.error('[Redis] Failed to invalidate role cache:', error);
  }
}

/**
 * Sync role between Clerk and Redis
 * @param userId - User ID from Clerk
 * @param clerkRole - Role from Clerk metadata
 * @param force - Force sync even if recently synced
 */
export async function syncUserRole(
  userId: string,
  clerkRole: string,
  force: boolean = false
): Promise<boolean> {
  try {
    // Check if recently synced (unless forced)
    if (!force) {
      const lastSync = await redis.get(REDIS_KEYS.SESSION_SYNC(userId));
      if (lastSync) {
        const syncTime = parseInt(lastSync as string);
        const timeDiff = Date.now() - syncTime;
        
        // Skip if synced within last 10 seconds
        if (timeDiff < 10000) {
          return true;
        }
      }
    }

    // Cache the role from Clerk
    await cacheUserRole(userId, clerkRole, {
      source: 'clerk',
      syncedAt: Date.now(),
      forced: force,
    });

    return true;
  } catch (error) {
    console.error('[Redis] Failed to sync user role:', error);
    return false;
  }
}

/**
 * Update role statistics in Redis
 * @param roleChange - Role change details
 */
export async function updateRoleStats(roleChange: {
  userId: string;
  oldRole?: string;
  newRole: string;
}): Promise<void> {
  try {
    // Get current stats
    const statsData = await redis.get(REDIS_KEYS.ROLE_STATS);
    let stats: RoleStats = statsData ? JSON.parse(statsData as string) : {
      admin: 0,
      merchant: 0,
      viewer: 0,
      total: 0,
      lastUpdated: 0,
    };

    // Update counts
    if (roleChange.oldRole && ['admin', 'merchant', 'viewer'].includes(roleChange.oldRole)) {
      stats[roleChange.oldRole as keyof Omit<RoleStats, 'total' | 'lastUpdated'>]--;
      stats.total--;
    }

    if (['admin', 'merchant', 'viewer'].includes(roleChange.newRole)) {
      stats[roleChange.newRole as keyof Omit<RoleStats, 'total' | 'lastUpdated'>]++;
      stats.total++;
    }

    stats.lastUpdated = Date.now();

    // Save updated stats
    await redis.setex(
      REDIS_KEYS.ROLE_STATS,
      300, // 5 minutes TTL
      JSON.stringify(stats)
    );

    console.log(`[Redis] Updated role stats:`, stats);
  } catch (error) {
    console.error('[Redis] Failed to update role stats:', error);
  }
}

/**
 * Get role statistics from Redis
 * @returns Current role statistics
 */
export async function getRoleStats(): Promise<RoleStats | null> {
  try {
    const statsData = await redis.get(REDIS_KEYS.ROLE_STATS);
    
    if (!statsData) {
      return null;
    }

    return JSON.parse(statsData as string) as RoleStats;
  } catch (error) {
    console.error('[Redis] Failed to get role stats:', error);
    return null;
  }
}

/**
 * Test Redis connection
 * @returns Connection status
 */
export async function testRedisConnection(): Promise<{
  connected: boolean;
  error?: string;
  latency?: number;
}> {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;

    return {
      connected: true,
      latency,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch invalidate multiple user roles
 * @param userIds - Array of user IDs to invalidate
 */
export async function batchInvalidateRoles(userIds: string[]): Promise<void> {
  try {
    const keys = userIds.flatMap(userId => [
      REDIS_KEYS.USER_ROLE(userId),
      REDIS_KEYS.SESSION_SYNC(userId),
      REDIS_KEYS.ROLE_CACHE(userId),
    ]);

    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[Redis] Batch invalidated ${userIds.length} user roles`);
    }
  } catch (error) {
    console.error('[Redis] Failed to batch invalidate roles:', error);
  }
}

// Export Redis instance for direct use if needed
export { redis as redisClient };