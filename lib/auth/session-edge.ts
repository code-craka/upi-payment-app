import { redis } from '@/lib/redis';
import type { UserRole } from '@/lib/types';

export interface SessionData {
  userId: string;
  email: string;
  role: UserRole;
  createdAt: number;
  lastAccess: number;
  metadata?: Record<string, unknown>;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Session TTL (24 hours)
const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds
const SESSION_PREFIX = 'session:';

/**
 * Generate a secure session token (Edge Runtime compatible)
 */
function generateSessionToken(): string {
  // Use Web Crypto API which is available in Edge Runtime
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback for environments without crypto
  console.warn('[Auth] Using fallback random generation - not cryptographically secure');
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Store session data in Redis
 */
export async function createSession(sessionData: Omit<SessionData, 'createdAt' | 'lastAccess'>): Promise<string> {
  const sessionToken = generateSessionToken();
  
  const data: SessionData = {
    ...sessionData,
    createdAt: Date.now(),
    lastAccess: Date.now(),
  };

  try {
    // Store the session in Redis with TTL
    await redis.setex(
      `${SESSION_PREFIX}${sessionToken}`,
      SESSION_TTL,
      JSON.stringify(data)
    );

    console.log(`[Auth] Session created for user ${sessionData.userId}`);
    return sessionToken;
  } catch (error) {
    console.error('[Auth] Failed to create session:', error);
    throw new Error('Failed to create session');
  }
}

/**
 * Get session data from Redis
 */
export async function getSession(token: string): Promise<SessionData | null> {
  if (!token) {
    return null;
  }

  try {
    const sessionKey = `${SESSION_PREFIX}${token}`;
    const sessionData = await redis.get(sessionKey);

    if (!sessionData) {
      return null;
    }

    // Upstash Redis automatically parses JSON, so check if it's already an object
    const parsed: SessionData = typeof sessionData === 'string'
      ? JSON.parse(sessionData)
      : sessionData as SessionData;

    // Update last access time
    const updatedData = {
      ...parsed,
      lastAccess: Date.now(),
    };

    // Extend the session TTL
    await redis.setex(
      `${SESSION_PREFIX}${token}`,
      SESSION_TTL,
      JSON.stringify(updatedData)
    );

    return updatedData;
  } catch (error) {
    console.error('[Auth] Failed to get session:', error);
    return null;
  }
}

/**
 * Delete a session from Redis
 */
export async function deleteSession(token: string): Promise<void> {
  if (!token) {
    return;
  }

  try {
    await redis.del(`${SESSION_PREFIX}${token}`);
    console.log('[Auth] Session deleted');
  } catch (error) {
    console.error('[Auth] Failed to delete session:', error);
    throw new Error('Failed to delete session');
  }
}

/**
 * Update session data
 */
export async function updateSession(token: string, updates: Partial<SessionData>): Promise<void> {
  if (!token) {
    throw new Error('Session token is required');
  }

  try {
    const existing = await getSession(token);
    if (!existing) {
      throw new Error('Session not found');
    }

    const updatedData = {
      ...existing,
      ...updates,
      lastAccess: Date.now(),
    };

    await redis.setex(
      `${SESSION_PREFIX}${token}`,
      SESSION_TTL,
      JSON.stringify(updatedData)
    );

    console.log(`[Auth] Session updated for user ${existing.userId}`);
  } catch (error) {
    console.error('[Auth] Failed to update session:', error);
    throw new Error('Failed to update session');
  }
}

/**
 * Get user from session token (Edge Runtime compatible)
 * This version only validates the session without database lookups
 */
export async function getUserFromSession(token: string): Promise<SessionData | null> {
  if (!token) {
    console.warn('[Auth] No session token provided');
    return null;
  }

  try {
    const sessionData = await getSession(token);
    if (!sessionData) {
      console.warn('[Auth] Invalid or expired session');
      return null;
    }

    // Check if session is still valid (within TTL)
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (now - sessionData.lastAccess > maxAge) {
      console.warn('[Auth] Session expired due to inactivity');
      await deleteSession(token);
      return null;
    }

    return sessionData;
  } catch (error) {
    console.error('[Auth] Failed to get user from session:', error);
    return null;
  }
}

/**
 * Edge Runtime compatible authentication check
 * Only validates session data without database queries
 */
export async function authenticateUser(token: string): Promise<SessionData | null> {
  return getUserFromSession(token);
}

/**
 * Clear all sessions for a user
 */
export async function clearUserSessions(userId: string): Promise<void> {
  try {
    // Get all session keys
    const keys = await redis.keys(`${SESSION_PREFIX}*`);
    
    if (keys.length === 0) {
      return;
    }

    // Get all session data to filter by userId
    const pipeline = redis.pipeline();
    keys.forEach(key => {
      pipeline.get(key);
    });
    
    const results = await pipeline.exec();
    const keysToDelete: string[] = [];
    
    results?.forEach((result, index) => {
      if (result && Array.isArray(result) && result[1]) {
        try {
          const sessionData: SessionData = JSON.parse(result[1] as string);
          if (sessionData.userId === userId) {
            keysToDelete.push(keys[index]);
          }
        } catch (_error) {
          // Invalid session data, mark for deletion
          keysToDelete.push(keys[index]);
        }
      }
    });

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      console.log(`[Auth] Cleared ${keysToDelete.length} sessions for user ${userId}`);
    }
  } catch (error) {
    console.error('[Auth] Failed to clear user sessions:', error);
    throw new Error('Failed to clear user sessions');
  }
}