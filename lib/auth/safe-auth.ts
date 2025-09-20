import { cookies } from 'next/headers';
import { getUserFromSession } from '@/lib/auth/session-edge';
import {
  type SafeUser,
  SafeUserSchema,
  type UserRole,
  PERMISSIONS,
  type Permission,
} from '@/lib/types';

/**
 * Get current authenticated user from session
 */
export async function getSafeUser(): Promise<SafeUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return null;
    }

    const sessionData = await getUserFromSession(sessionToken);
    if (!sessionData) {
      return null;
    }

    // Extract name from metadata if available
    const fullName = sessionData.metadata?.name as string || '';
    const nameParts = fullName.split(' ');

    const safeUser: SafeUser = {
      id: sessionData.userId,
      email: sessionData.email,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      role: sessionData.role,
      createdAt: new Date(sessionData.createdAt),
      updatedAt: new Date(sessionData.lastAccess),
    };

    return SafeUserSchema.parse(safeUser);
  } catch (error) {
    console.error('Error getting safe user:', error);
    return null;
  }
}

export async function requireAuth(): Promise<SafeUser> {
  const user = await getSafeUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

export async function requireRole(requiredRole: UserRole): Promise<SafeUser> {
  const user = await requireAuth();
  if (user.role !== requiredRole && user.role !== 'admin') {
    throw new Error(`Role ${requiredRole} required`);
  }
  return user;
}

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const rolePermissions = PERMISSIONS[userRole] || [];
  return (rolePermissions as readonly Permission[]).includes(permission) || userRole === 'admin';
}

export async function requirePermission(permission: Permission): Promise<SafeUser> {
  const user = await requireAuth();
  if (!hasPermission(user.role, permission)) {
    throw new Error(`Permission ${permission} required`);
  }
  return user;
}
