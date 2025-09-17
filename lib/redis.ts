import { Redis } from '@upstash/redis';
import { redisCircuitBreaker } from './redis/circuit-breaker';

// Edge-safe Redis client for hybrid authentication caching
// Production deployment on Vercel Edge Runtime
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  throw new Error('Redis environment variables not configured');
}

export const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

// Redis keys for role management
export const REDIS_KEYS = {
  USER_ROLE: (userId: string) => `user_role:${userId}`,
  USER_ROLE_VERSION: (userId: string) => `user_role_version:${userId}`,
  SESSION_SYNC: (userId: string) => `session_sync:${userId}`,
  ROLE_CACHE: (userId: string) => `role_cache:${userId}`,
  ROLE_VERSION: (userId: string) => `role_version:${userId}`,
  INVALIDATION_LOG: (userId: string) => `invalidation_log:${userId}`,
  ADMIN_BOOTSTRAP: 'admin:bootstrap:status',
  ROLE_STATS: 'roles:stats',
  ROLE_UPDATES_CHANNEL: 'role-updates',
} as const;

// Role cache TTL (30 seconds as per hybrid authentication requirements)
export const ROLE_CACHE_TTL = 30; // 30 seconds for security

// Session data interface
export interface RedisSessionData {
  userId: string;
  role: string;
  lastSync: number;
  clerkSync: boolean;
  version: number;
  metadata?: Record<string, unknown>;
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
 * Cache user role in Redis with TTL using atomic operations
 * @param userId - User ID from Clerk
 * @param role - User role (admin, merchant, viewer)
 * @param metadata - Additional role metadata
 */
export async function cacheUserRole(
  userId: string,
  role: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // Atomic role caching with version increment using Lua script
    const luaScript = `
      local version = redis.call('INCR', KEYS[2])
      local sessionData = ARGV[1]
      local ttl = tonumber(ARGV[2])
      local syncTime = ARGV[3]
      
      -- Set role data with TTL
      redis.call('SETEX', KEYS[1], ttl, sessionData)
      
      -- Set session sync with same TTL
      redis.call('SETEX', KEYS[3], ttl, syncTime)
      
      return version
    `;

    const sessionData: RedisSessionData = {
      userId,
      role,
      lastSync: Date.now(),
      clerkSync: true,
      version: 0, // Will be set by Lua script
      metadata,
    };

    const version = await redisCircuitBreaker.execute(() =>
      redis.eval(
        luaScript,
        [
          REDIS_KEYS.USER_ROLE(userId),
          REDIS_KEYS.USER_ROLE_VERSION(userId),
          REDIS_KEYS.SESSION_SYNC(userId)
        ],
        [
          JSON.stringify({ ...sessionData, version: 0 }),
          ROLE_CACHE_TTL.toString(),
          Date.now().toString()
        ]
      )
    );

    // Log successful cache operation (server-side only)
    if (typeof window === 'undefined') {
      console.log(`[Redis] Cached role for user ${userId}: ${role} (v${version})`);
    }
  } catch (error) {
    // Log error (server-side only)
    if (typeof window === 'undefined') {
      console.error('[Redis] Failed to cache user role:', error);
    }
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
    const cached = await redisCircuitBreaker.execute(() =>
      redis.get(REDIS_KEYS.USER_ROLE(userId))
    );

    if (!cached) {
      return null;
    }

    const sessionData: RedisSessionData = JSON.parse(cached as string);

    // Verify data integrity
    if (!sessionData.userId || !sessionData.role) {
      if (typeof window === 'undefined') {
        console.warn(`[Redis] Invalid cached data for user ${userId}`);
      }
      return null;
    }

    return sessionData;
  } catch (error) {
    if (typeof window === 'undefined') {
      console.error('[Redis] Failed to get cached role:', error);
    }
    return null;
  }
}

/**
 * Invalidate user role cache with atomic operations
 * Uses Lua script to ensure atomic deletion of all user-related cache keys
 * @param userId - User ID to invalidate cache for
 */
export async function invalidateUserRole(userId: string): Promise<void> {
  try {
    // Atomic cache invalidation using Lua script
    const luaScript = `
      local keys = {
        KEYS[1], -- user_role key
        KEYS[2], -- session_sync key
        KEYS[3]  -- role_cache key
      }
      
      local deleted = 0
      for i = 1, #keys do
        if redis.call('EXISTS', keys[i]) == 1 then
          redis.call('DEL', keys[i])
          deleted = deleted + 1
        end
      end
      
      -- Log invalidation timestamp
      redis.call('SETEX', KEYS[4], 300, ARGV[1])
      
      return deleted
    `;

    const deletedCount = await redisCircuitBreaker.execute(() =>
      redis.eval(
        luaScript,
        [
          REDIS_KEYS.USER_ROLE(userId),
          REDIS_KEYS.SESSION_SYNC(userId), 
          REDIS_KEYS.ROLE_CACHE(userId),
          REDIS_KEYS.INVALIDATION_LOG(userId)
        ],
        [Date.now().toString()]
      )
    );

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`[Redis] Atomically invalidated ${deletedCount} cache keys for user ${userId}`);
    }
  } catch (error) {
    console.error('[Redis] Failed to atomically invalidate role cache:', error);
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
  force = false
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
    const stats: RoleStats = statsData ? JSON.parse(statsData as string) : {
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

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[Redis] Updated role stats:', stats);
    }
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
 * Batch invalidate multiple user roles with atomic operations
 * Uses Lua script to atomically invalidate all keys for multiple users
 * @param userIds - Array of user IDs to invalidate
 */
export async function batchInvalidateRoles(userIds: string[]): Promise<void> {
  try {
    if (userIds.length === 0) return;

    // Atomic batch invalidation using Lua script
    const luaScript = `
      local deleted = 0
      local userCount = #ARGV
      
      for i = 1, userCount do
        local userId = ARGV[i]
        local keys = {
          'user_role:' .. userId,
          'session_sync:' .. userId,
          'role_cache:' .. userId,
          'role_version:' .. userId
        }
        
        for j = 1, #keys do
          if redis.call('EXISTS', keys[j]) == 1 then
            redis.call('DEL', keys[j])
            deleted = deleted + 1
          end
        end
      end
      
      -- Log batch invalidation
      redis.call('SETEX', 'batch_invalidation:' .. ARGV[userCount + 1], 300, deleted)
      
      return deleted
    `;

    const deletedCount = await redisCircuitBreaker.execute(() =>
      redis.eval(
        luaScript,
        [],
        [...userIds, Date.now().toString()]
      )
    );

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`[Redis] Batch invalidated ${deletedCount} cache keys for ${userIds.length} users`);
    }
  } catch (error) {
    console.error('[Redis] Failed to batch invalidate roles:', error);
  }
}

// Export Redis instance for direct use if needed
export { redis as redisClient };