import { redis } from '@/lib/redis';
import { connectDB } from '@/lib/db/connection';
import type { UserRole } from '@/lib/types';

// Conditional imports for Edge Runtime compatibility
let UserModel: unknown = null;
let bcrypt: unknown = null;

// Only import these in Node.js runtime (not Edge Runtime)
if (typeof process !== 'undefined' && process.versions?.node) {
  try {
    UserModel = require('@/lib/db/models/User').UserModel;
    bcrypt = require('bcryptjs');
  } catch (_error) {
    console.warn('[Auth] Could not load Node.js dependencies in Edge Runtime');
  }
}

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
 * Get Redis key for session token
 */
function getSessionKey(token: string): string {
  return `${SESSION_PREFIX}${token}`;
}

/**
 * Create a new session for a user
 * @param userId - User ID
 * @param email - User email
 * @param role - User role
 * @param metadata - Optional session metadata
 * @returns Session token
 */
export async function createSession(
  userId: string,
  email: string,
  role: UserRole,
  metadata?: Record<string, unknown>
): Promise<string> {
  const token = generateSessionToken();
  const sessionData: SessionData = {
    userId,
    email,
    role,
    createdAt: Date.now(),
    lastAccess: Date.now(),
    metadata,
  };

  try {
    // Store session in Redis with TTL
    await redis.setex(
      getSessionKey(token),
      SESSION_TTL,
      JSON.stringify(sessionData)
    );

    console.log(`[Auth] Created session for user ${userId} (${role})`);
    return token;
  } catch (error) {
    console.error('[Auth] Failed to create session:', error);
    throw new Error('Failed to create session');
  }
}

/**
 * Get session data from token
 * @param token - Session token
 * @returns Session data or null if not found/expired
 */
export async function getSession(token: string): Promise<SessionData | null> {
  if (!token) {
    return null;
  }

  try {
    const sessionJson = await redis.get(getSessionKey(token));

    if (!sessionJson) {
      return null;
    }

    const sessionData: SessionData = JSON.parse(sessionJson as string);

    // Update last access time
    sessionData.lastAccess = Date.now();

    // Refresh session TTL
    await redis.setex(
      getSessionKey(token),
      SESSION_TTL,
      JSON.stringify(sessionData)
    );

    return sessionData;
  } catch (error) {
    console.error('[Auth] Failed to get session:', error);
    return null;
  }
}

/**
 * Get user data from session token
 * @param token - Session token
 * @returns User data or null if not found
 */
export async function getUserFromSession(token: string): Promise<AuthUser | null> {
  const sessionData = await getSession(token);

  if (!sessionData) {
    return null;
  }

  try {
    // Check if we're in Edge Runtime (UserModel will be null)
    if (!UserModel) {
      // In Edge Runtime (middleware), we can't access the database
      // Return user data from session cache only
      return {
        id: sessionData.userId,
        email: sessionData.email,
        name: undefined, // Not available in session cache
        role: sessionData.role,
        isActive: true, // Assume active if session exists
        createdAt: new Date(), // Placeholder
        updatedAt: new Date(), // Placeholder
      };
    }

    await connectDB();
    const user = await (UserModel as any).findById(sessionData.userId).select('-passwordHash');

    if (!user || !user.isActive) {
      // Invalid user, destroy session
      await destroySession(token);
      return null;
    }

    return {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  } catch (error) {
    console.error('[Auth] Failed to get user from session:', error);
    return null;
  }
}

/**
 * Destroy a session
 * @param token - Session token to destroy
 */
export async function destroySession(token: string): Promise<void> {
  if (!token) {
    return;
  }

  try {
    await redis.del(getSessionKey(token));
    console.log('[Auth] Session destroyed');
  } catch (error) {
    console.error('[Auth] Failed to destroy session:', error);
    throw new Error('Failed to destroy session');
  }
}

/**
 * Authenticate user with email and password
 * @param email - User email
 * @param password - User password
 * @returns Session token or null if authentication failed
 */
export async function authenticateUser(email: string, password: string): Promise<string | null> {
  try {
    // Check if we're in Edge Runtime (UserModel will be null)
    if (!UserModel) {
      // In Edge Runtime, we can't authenticate against the database
      console.warn('[Auth] Authentication not available in Edge Runtime');
      return null;
    }

    await connectDB();

    // Find user by email
    const user = await (UserModel as any).findOne({
      email: email.toLowerCase(),
      isActive: true
    });

    if (!user) {
      return null;
    }

    // Verify password
    const isValid = await (bcrypt as any).compare(password, user.passwordHash);

    if (!isValid) {
      return null;
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Create session
    const token = await createSession(
      user.id.toString(),
      user.email,
      user.role,
      {
        loginTime: Date.now(),
        userAgent: 'unknown', // Will be set by caller if available
      }
    );

    return token;
  } catch (error) {
    console.error('[Auth] Authentication failed:', error);
    return null;
  }
}

/**
 * Hash password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return (bcrypt as any).hash(password, saltRounds);
}

/**
 * Verify password against hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns True if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (bcrypt as any).compare(password, hash);
}

/**
 * Refresh session TTL
 * @param token - Session token
 */
export async function refreshSession(token: string): Promise<boolean> {
  if (!token) {
    return false;
  }

  try {
    const sessionData = await getSession(token);

    if (!sessionData) {
      return false;
    }

    // Update last access
    sessionData.lastAccess = Date.now();

    // Refresh TTL
    await redis.setex(
      getSessionKey(token),
      SESSION_TTL,
      JSON.stringify(sessionData)
    );

    return true;
  } catch (error) {
    console.error('[Auth] Failed to refresh session:', error);
    return false;
  }
}

/**
 * Get all active sessions for a user
 * @param _userId - User ID (unused in current implementation)
 * @returns Array of active session tokens
 */
export async function getUserSessions(_userId: string): Promise<string[]> {
  // This would require scanning Redis keys, which is expensive
  // For now, we'll return empty array - sessions are managed per-token
  // In production, consider maintaining a user->sessions mapping
  return [];
}

/**
 * Destroy all sessions for a user
 * @param userId - User ID
 */
export async function destroyUserSessions(userId: string): Promise<void> {
  try {
    const sessions = await getUserSessions(userId);

    for (const token of sessions) {
      await destroySession(token);
    }

    console.log(`[Auth] Destroyed ${sessions.length} sessions for user ${userId}`);
  } catch (error) {
    console.error('[Auth] Failed to destroy user sessions:', error);
  }
}