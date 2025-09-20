import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getUserFromSession, type SessionData } from './session-edge';
import { roleHasPermission, type UserRole, type Permission } from '@/lib/types/roles';

// AuthUser interface compatible with SessionData
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Convert SessionData to AuthUser format
function sessionToAuthUser(sessionData: SessionData): AuthUser {
  return {
    id: sessionData.userId,
    email: sessionData.email,
    role: sessionData.role,
    name: sessionData.metadata?.name as string | undefined,
    isActive: true, // Session exists means user is active
    createdAt: new Date(sessionData.createdAt),
    updatedAt: new Date(sessionData.lastAccess),
  };
}

/**
 * Get session token from request
 */
async function getSessionToken(req?: NextRequest): Promise<string | null> {
  if (req) {
    // For middleware and API routes with NextRequest
    return req.cookies.get('session')?.value || null;
  } else {
    // For server components and API routes
    try {
      const cookieStore = await cookies();
      return cookieStore.get('session')?.value || null;
    } catch {
      return null;
    }
  }
}

/**
 * Require authentication - throws error if not authenticated
 * @param req - Optional NextRequest for middleware usage
 * @returns Authenticated user data
 */
export async function requireAuth(req?: NextRequest): Promise<AuthUser> {
  const token = await getSessionToken(req);

  if (!token) {
    throw new Error('Authentication required');
  }

  const sessionData = await getUserFromSession(token);

  if (!sessionData) {
    throw new Error('Invalid or expired session');
  }

  return sessionToAuthUser(sessionData);
}

/**
 * Require specific role - throws error if insufficient permissions
 * @param requiredRole - Required role
 * @param req - Optional NextRequest for middleware usage
 * @returns Authenticated user data
 */
export async function requireRole(requiredRole: UserRole, req?: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(req);

  // Admin can access everything
  if (user.role === 'admin') {
    return user;
  }

  // Check exact role match
  if (user.role !== requiredRole) {
    throw new Error(`Role ${requiredRole} required`);
  }

  return user;
}

/**
 * Require specific permission - throws error if insufficient permissions
 * @param permission - Required permission
 * @param req - Optional NextRequest for middleware usage
 * @returns Authenticated user data
 */
export async function requirePermission(permission: Permission, req?: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(req);

  if (!roleHasPermission(user.role, permission)) {
    throw new Error(`Permission ${permission} required`);
  }

  return user;
}

/**
 * Check if user has specific role (non-throwing)
 * @param requiredRole - Required role
 * @param req - Optional NextRequest for middleware usage
 * @returns True if user has role, false otherwise
 */
export async function hasRole(requiredRole: UserRole, req?: NextRequest): Promise<boolean> {
  try {
    const user = await requireAuth(req);
    return user.role === 'admin' || user.role === requiredRole;
  } catch {
    return false;
  }
}

/**
 * Check if user has specific permission (non-throwing)
 * @param permission - Required permission
 * @param req - Optional NextRequest for middleware usage
 * @returns True if user has permission, false otherwise
 */
export async function hasPermission(permission: Permission, req?: NextRequest): Promise<boolean> {
  try {
    const user = await requireAuth(req);
    return roleHasPermission(user.role, permission);
  } catch {
    return false;
  }
}

/**
 * Get current user if authenticated (non-throwing)
 * @param req - Optional NextRequest for middleware usage
 * @returns User data or null if not authenticated
 */
export async function getCurrentUser(req?: NextRequest): Promise<AuthUser | null> {
  try {
    return await requireAuth(req);
  } catch {
    return null;
  }
}

/**
 * Admin role checker
 * @param req - Optional NextRequest for middleware usage
 * @returns Authenticated admin user
 */
export async function requireAdmin(req?: NextRequest): Promise<AuthUser> {
  return requireRole('admin', req);
}

/**
 * Merchant role checker
 * @param req - Optional NextRequest for middleware usage
 * @returns Authenticated merchant user
 */
export async function requireMerchant(req?: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(req);

  if (user.role !== 'admin' && user.role !== 'merchant') {
    throw new Error('Merchant role required');
  }

  return user;
}

/**
 * User role checker (replaces viewer)
 * @param req - Optional NextRequest for middleware usage
 * @returns Authenticated user
 */
export async function requireUser(req?: NextRequest): Promise<AuthUser> {
  // Any authenticated user can access user-level content
  return requireAuth(req);
}

/**
 * Check if user is admin (non-throwing)
 * @param req - Optional NextRequest for middleware usage
 * @returns True if user is admin
 */
export async function isAdmin(req?: NextRequest): Promise<boolean> {
  return hasRole('admin', req);
}

/**
 * Check if user is merchant or admin (non-throwing)
 * @param req - Optional NextRequest for middleware usage
 * @returns True if user is merchant or admin
 */
export async function isMerchant(req?: NextRequest): Promise<boolean> {
  try {
    const user = await requireAuth(req);
    return user.role === 'admin' || user.role === 'merchant';
  } catch {
    return false;
  }
}

/**
 * API route wrapper for role checking
 * @param handler - API route handler
 * @param requiredRole - Required role for the route
 * @returns Wrapped handler with role checking
 */
export function withRole<T extends AuthUser>(
  handler: (req: NextRequest, user: T) => Promise<Response>,
  requiredRole: UserRole
) {
  return async (req: NextRequest): Promise<Response> => {
    try {
      const user = await requireRole(requiredRole, req);
      return handler(req, user as T);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authorization failed';
      return new Response(JSON.stringify({ error: message }), {
        status: error instanceof Error && error.message.includes('Authentication') ? 401 : 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

/**
 * API route wrapper for permission checking
 * @param handler - API route handler
 * @param requiredPermission - Required permission for the route
 * @returns Wrapped handler with permission checking
 */
export function withPermission<T extends AuthUser>(
  handler: (req: NextRequest, user: T) => Promise<Response>,
  requiredPermission: Permission
) {
  return async (req: NextRequest): Promise<Response> => {
    try {
      const user = await requirePermission(requiredPermission, req);
      return handler(req, user as T);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authorization failed';
      return new Response(JSON.stringify({ error: message }), {
        status: error instanceof Error && error.message.includes('Authentication') ? 401 : 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}