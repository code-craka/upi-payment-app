/**
 * Development Authentication Helper
 *
 * Provides a simple authentication bypass for development when Clerk keys are not available.
 * This should NOT be used in production.
 */

export interface DevUser {
  id: string;
  email: string;
  role: 'admin' | 'merchant' | 'user';
  name: string;
}

/**
 * Unified user type that works with both Clerk and development auth
 */
export type UnifiedUser = DevUser | {
  id: string;
  emailAddresses?: Array<{ emailAddress: string }>;
  publicMetadata?: { role?: string };
};

/**
 * Mock user for development
 */
const DEV_USER: DevUser = {
  id: 'dev-user-123',
  email: 'admin@upi-dashboard.dev',
  role: 'admin',
  name: 'Development Admin'
};

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get current user for development
 */
export function getDevUser(): DevUser | null {
  if (!isDevelopment()) {
    return null;
  }

  // Check if dev auth is enabled via environment variable
  if (process.env.ENABLE_DEV_AUTH !== 'true') {
    return null;
  }

  return DEV_USER;
}

/**
 * Simulate Clerk's currentUser() function for development
 */
export async function devCurrentUser(): Promise<DevUser | null> {
  return getDevUser();
}

/**
 * Check if user has admin role (works with both Clerk and Dev users)
 */
export function isAdmin(user: UnifiedUser | null): boolean {
  if (!user) return false;

  // Check if it's a DevUser
  if ('role' in user) {
    return user.role === 'admin';
  }

  // Check if it's a Clerk user
  return user.publicMetadata?.role === 'admin';
}

/**
 * Check if user has merchant role (works with both Clerk and Dev users)
 */
export function isMerchant(user: UnifiedUser | null): boolean {
  if (!user) return false;

  // Check if it's a DevUser
  if ('role' in user) {
    return user.role === 'merchant';
  }

  // Check if it's a Clerk user
  return user.publicMetadata?.role === 'merchant';
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(user: UnifiedUser | null): boolean {
  return !!user;
}

/**
 * Get user role from unified user type
 */
export function getUserRole(user: UnifiedUser | null): string | null {
  if (!user) return null;

  // Check if it's a DevUser
  if ('role' in user) {
    return user.role;
  }

  // Check if it's a Clerk user
  return user.publicMetadata?.role || null;
}