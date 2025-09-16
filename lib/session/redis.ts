import Redis from 'ioredis'
import { SessionData, SessionDataSchema, UserRole, type SessionResponse } from '@/lib/types'
import { serverLogger } from '@/lib/utils/server-logger'
import { getPermissionsForRole } from '@/lib/types/roles'

// Redis client singleton
let redis: Redis | null = null

function getRedisClient(): Redis {
  if (!redis) {
    const redisHost = process.env.REDIS_HOST || 'localhost'
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10)
    const redisPassword = process.env.REDIS_PASSWORD

    redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
      // Configure connection timeout
      connectTimeout: 5000,
      commandTimeout: 5000,
    })

    // Handle connection events
    redis.on('ready', () => {
      serverLogger.info('Redis connection established successfully')
    })

    redis.on('error', (error: Error) => {
      serverLogger.error('Redis connection error', error)
    })
  }
  
  return redis
}

// Session key prefix
const SESSION_PREFIX = 'user_session:'
const SESSION_TTL = 60 * 60 * 24 * 30 // 30 days in seconds

/**
 * Generate Redis key for user session
 */
function getSessionKey(userId: string): string {
  return `${SESSION_PREFIX}${userId}`
}

/**
 * Get user session from Redis with auto TTL refresh
 * @param userId - User ID
 * @param refreshTTL - Whether to refresh TTL on access (default: false)
 * @returns SessionData or null if no session exists
 */
export async function getSession(userId: string, refreshTTL = false): Promise<SessionData | null> {
  try {
    const client = getRedisClient()
    const sessionKey = getSessionKey(userId)
    
    const sessionData = await client.get(sessionKey)
    
    if (!sessionData) {
      serverLogger.debug('No session found in Redis', { userId })
      return null
    }

    // Parse and validate session data
    const parsed = JSON.parse(sessionData)
    // Convert updatedAt string back to Date
    if (parsed.updatedAt) {
      parsed.updatedAt = new Date(parsed.updatedAt)
    }
    
    const validated = SessionDataSchema.parse(parsed)
    
    // Auto-refresh TTL if session exists and flag is set
    if (refreshTTL) {
      try {
        await client.expire(sessionKey, SESSION_TTL)
        serverLogger.debug('Session TTL auto-refreshed on access', { userId, ttl: SESSION_TTL })
      } catch (refreshError) {
        // Don't fail the whole operation if TTL refresh fails
        serverLogger.warn('Failed to refresh TTL on session access', { userId, error: refreshError })
      }
    }
    
    serverLogger.debug('Session retrieved from Redis', { 
      userId, 
      role: validated.role,
      updatedAt: validated.updatedAt,
      ttlRefreshed: refreshTTL
    })
    
    return validated

  } catch (error) {
    serverLogger.error('Failed to get session from Redis - cluster may be unavailable', error, { userId })
    return null
  }
}

/**
 * Set user session in Redis with automatic permission mapping
 * @param userId - User ID
 * @param data - Session data to store (role and optional custom permissions)
 * @returns Promise<boolean> - Success status
 */
export async function setSession(
  userId: string, 
  data: { role: UserRole; permissions?: string[] }
): Promise<boolean> {
  try {
    const client = getRedisClient()
    const sessionKey = getSessionKey(userId)
    
    // Get default permissions for role, then merge with any custom permissions
    const defaultPermissions = Array.from(getPermissionsForRole(data.role))
    const customPermissions = data.permissions || []
    const allPermissions = Array.from(new Set([...defaultPermissions, ...customPermissions]))
    
    const sessionData: SessionData = {
      role: data.role,
      permissions: allPermissions,
      updatedAt: new Date(),
    }

    // Validate data before storing
    const validated = SessionDataSchema.parse(sessionData)
    
    // Store in Redis with TTL
    const result = await client.setex(
      sessionKey, 
      SESSION_TTL, 
      JSON.stringify(validated)
    )
    
    if (result === 'OK') {
      serverLogger.info('Session updated in Redis with role permissions', { 
        userId, 
        role: validated.role, 
        permissionCount: validated.permissions?.length || 0,
        defaultPermissionCount: defaultPermissions.length,
        customPermissionCount: customPermissions.length,
        ttl: SESSION_TTL
      })
      return true
    }
    
    return false

  } catch (error) {
    serverLogger.error('Failed to set session in Redis - cluster may be unavailable', error, { 
      userId, 
      role: data.role 
    })
    return false
  }
}

/**
 * Delete user session from Redis
 * @param userId - User ID
 * @returns Promise<boolean> - Success status
 */
export async function deleteSession(userId: string): Promise<boolean> {
  try {
    const client = getRedisClient()
    const sessionKey = getSessionKey(userId)
    
    const result = await client.del(sessionKey)
    
    if (result === 1) {
      serverLogger.info('Session deleted from Redis', { userId })
      return true
    }
    
    serverLogger.warn('Session not found for deletion', { userId })
    return false

  } catch (error) {
    serverLogger.error('Failed to delete session from Redis - cluster may be unavailable', error, { userId })
    return false
  }
}

/**
 * Alias for deleteSession - for immediate role invalidation
 * @param userId - User ID
 * @returns Promise<boolean> - Success status
 */
export const delSession = deleteSession

/**
 * Helper function to get session with admin privilege check
 * @param userId - User ID
 * @returns Promise<SessionData | null> - Session data or null
 */
async function getSessionWithAdminCheck(userId: string): Promise<SessionData | null> {
  const session = await getSession(userId)
  return session
}

/**
 * Check if user has required role
 * @param userId - User ID
 * @param requiredRole - Required role
 * @returns Promise<boolean> - Whether user has required role
 */
export async function hasRole(userId: string, requiredRole: UserRole): Promise<boolean> {
  try {
    const session = await getSessionWithAdminCheck(userId)
    
    if (!session) {
      return false
    }
    
    // Admin has access to everything
    if (session.role === 'admin') {
      return true
    }
    
    return session.role === requiredRole

  } catch (error) {
    serverLogger.error('Failed to check user role - Redis may be unavailable', error, { userId, requiredRole })
    return false
  }
}

/**
 * Check if user has required permission
 * @param userId - User ID  
 * @param requiredPermission - Required permission
 * @returns Promise<boolean> - Whether user has required permission
 */
export async function hasPermission(userId: string, requiredPermission: string): Promise<boolean> {
  try {
    const session = await getSessionWithAdminCheck(userId)
    
    if (!session) {
      return false
    }
    
    // Admin has all permissions
    if (session.role === 'admin') {
      return true
    }
    
    return session.permissions?.includes(requiredPermission) ?? false

  } catch (error) {
    serverLogger.error('Failed to check user permission - Redis may be unavailable', error, { userId, requiredPermission })
    return false
  }
}

/**
 * Get session response for API endpoints
 * @param userId - User ID
 * @returns Promise<SessionResponse> - Formatted session response
 */
export async function getSessionResponse(userId: string): Promise<SessionResponse> {
  try {
    const session = await getSession(userId)
    
    if (!session) {
      return {
        userId,
        role: null,
        permissions: [],
        updatedAt: null,
        hasSession: false,
      }
    }
    
    return {
      userId,
      role: session.role,
      permissions: session.permissions || [],
      updatedAt: session.updatedAt,
      hasSession: true,
    }

  } catch (error) {
    serverLogger.error('Failed to get session response', error, { userId })
    return {
      userId,
      role: null,
      permissions: [],
      updatedAt: null,
      hasSession: false,
    }
  }
}

/**
 * Refresh session TTL without changing data
 * @param userId - User ID
 * @returns Promise<boolean> - Success status
 */
export async function refreshSession(userId: string): Promise<boolean> {
  try {
    const client = getRedisClient()
    const sessionKey = getSessionKey(userId)
    
    // Check if session exists
    const exists = await client.exists(sessionKey)
    if (!exists) {
      return false
    }
    
    // Refresh TTL
    const result = await client.expire(sessionKey, SESSION_TTL)
    
    if (result === 1) {
      serverLogger.debug('Session TTL refreshed', { userId, ttl: SESSION_TTL })
      return true
    }
    
    return false

  } catch (error) {
    serverLogger.error('Failed to refresh session TTL', error, { userId })
    return false
  }
}

/**
 * Health check for Redis connection
 * @returns Promise<boolean> - Redis connection status
 */
export async function redisHealthCheck(): Promise<boolean> {
  try {
    const client = getRedisClient()
    const result = await client.ping()
    return result === 'PONG'
  } catch (error) {
    serverLogger.error('Redis health check failed', error)
    return false
  }
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeRedisConnection(): Promise<void> {
  try {
    if (redis) {
      await redis.quit()
      redis = null
      serverLogger.info('Redis connection closed')
    }
  } catch (error) {
    serverLogger.error('Failed to close Redis connection', error)
  }
}