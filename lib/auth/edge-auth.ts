import { NextRequest } from 'next/server';
import { redis } from '@/lib/redis';
import type { UserRole } from '@/lib/types';

export interface EdgeAuthUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

/**
 * Get session token from request cookies (Edge Runtime compatible)
 */
function getSessionToken(req: NextRequest): string | null {
  return req.cookies.get('session')?.value || null;
}

/**
 * Get user from session token (Edge Runtime compatible - Redis only)
 */
export async function getCurrentUserEdge(req: NextRequest): Promise<EdgeAuthUser | null> {
  try {
    const token = getSessionToken(req);
    if (!token) {
      return null;
    }

    // Get session data from Redis
    const sessionKey = `session:${token}`;
    const sessionData = await redis.get(sessionKey);

    if (!sessionData) {
      return null;
    }

    const session = JSON.parse(sessionData as string);

    return {
      id: session.userId,
      email: session.email,
      role: session.role,
      isActive: true, // If session exists, user is active
    };
  } catch (error) {
    console.error('[Edge Auth] Error getting user:', error);
    return null;
  }
}

/**
 * Check if user has specific role (Edge Runtime compatible)
 */
export async function hasRoleEdge(role: UserRole, req: NextRequest): Promise<boolean> {
  try {
    const user = await getCurrentUserEdge(req);
    if (!user) {
      return false;
    }

    // Admin has access to everything
    if (user.role === 'admin') {
      return true;
    }

    // Check specific role
    return user.role === role;
  } catch (error) {
    console.error('[Edge Auth] Error checking role:', error);
    return false;
  }
}