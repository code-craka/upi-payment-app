import { currentUser } from '@clerk/nextjs/server';
import {
  type SafeUser,
  SafeUserSchema,
  type UserRole,
  PERMISSIONS,
  type Permission,
} from '@/lib/types';

export async function getSafeUser(): Promise<SafeUser | null> {
  try {
    const user = await currentUser();
    if (!user) return null;

    const safeUser: SafeUser = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || '',
      firstName: user.firstName,
      lastName: user.lastName,
      role: (user.publicMetadata?.role as UserRole) || 'viewer',
      createdAt: new Date(user.createdAt),
      updatedAt: new Date(user.updatedAt),
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
