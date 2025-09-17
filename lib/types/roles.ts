import type { UserRole } from '@/lib/types';

/**
 * Static mapping of roles to their permissions
 * This ensures consistent permission assignment across the application
 */
export const rolePermissions = {
  admin: [
    // User Management
    'manage_users',
    'view_users',
    'create_users',
    'edit_users',
    'delete_users',
    'assign_roles',

    // Order Management
    'view_all_orders',
    'manage_orders',
    'verify_payments',
    'process_refunds',
    'export_orders',

    // System Administration
    'view_audit_logs',
    'manage_system_settings',
    'view_analytics',
    'manage_security_settings',
    'access_debug_tools',
    'view_system_health',

    // Payment Operations
    'create_payments',
    'view_payment_details',
    'manage_payment_methods',
    'process_bulk_payments',

    // Administrative
    'full_admin_access',
    'manage_roles',
    'system_configuration',
  ],

  merchant: [
    // Order Management (own orders only)
    'view_own_orders',
    'create_orders',
    'verify_own_payments',
    'export_own_orders',

    // Payment Operations
    'create_payments',
    'view_payment_details',
    'manage_own_payment_methods',

    // Basic Analytics
    'view_own_analytics',
    'view_payment_stats',

    // Profile Management
    'manage_own_profile',
    'view_own_audit_logs',
  ],

  viewer: [
    // Read-only access
    'view_public_data',
    'view_own_profile',
    'view_own_orders',
    'view_own_payments',

    // Limited Analytics
    'view_basic_stats',
  ],
} as const;

/**
 * Get permissions for a specific role
 * @param role - User role
 * @returns Array of permission strings
 */
export function getPermissionsForRole(role: UserRole): readonly string[] {
  return rolePermissions[role] || [];
}

/**
 * Check if a role has a specific permission
 * @param role - User role
 * @param permission - Permission to check
 * @returns Whether the role has the permission
 */
export function roleHasPermission(role: UserRole, permission: string): boolean {
  const permissions = rolePermissions[role] || [];

  // Admin always has all permissions
  if (role === 'admin') {
    return true;
  }

  return (permissions as readonly string[]).includes(permission);
}

/**
 * Get all unique permissions across all roles
 * @returns Array of all possible permissions
 */
export function getAllPermissions(): string[] {
  const allPermissions = new Set<string>();

  Object.values(rolePermissions).forEach((permissions) => {
    permissions.forEach((permission) => allPermissions.add(permission));
  });

  return Array.from(allPermissions).sort();
}

/**
 * Permission categories for easier management
 */
export const permissionCategories = {
  userManagement: [
    'manage_users',
    'view_users',
    'create_users',
    'edit_users',
    'delete_users',
    'assign_roles',
  ],

  orderManagement: [
    'view_all_orders',
    'view_own_orders',
    'manage_orders',
    'create_orders',
    'verify_payments',
    'verify_own_payments',
    'process_refunds',
    'export_orders',
    'export_own_orders',
  ],

  systemAdmin: [
    'view_audit_logs',
    'manage_system_settings',
    'view_analytics',
    'manage_security_settings',
    'access_debug_tools',
    'view_system_health',
    'full_admin_access',
    'manage_roles',
    'system_configuration',
  ],

  paymentOperations: [
    'create_payments',
    'view_payment_details',
    'manage_payment_methods',
    'manage_own_payment_methods',
    'process_bulk_payments',
  ],

  analytics: ['view_analytics', 'view_own_analytics', 'view_payment_stats', 'view_basic_stats'],

  profile: ['manage_own_profile', 'view_own_audit_logs', 'view_public_data', 'view_own_payments'],
} as const;

/**
 * Type-safe permission constants
 */
export const PERMISSIONS = {
  // User Management
  MANAGE_USERS: 'manage_users',
  VIEW_USERS: 'view_users',
  CREATE_USERS: 'create_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',
  ASSIGN_ROLES: 'assign_roles',

  // Order Management
  VIEW_ALL_ORDERS: 'view_all_orders',
  VIEW_OWN_ORDERS: 'view_own_orders',
  MANAGE_ORDERS: 'manage_orders',
  CREATE_ORDERS: 'create_orders',
  VERIFY_PAYMENTS: 'verify_payments',
  VERIFY_OWN_PAYMENTS: 'verify_own_payments',
  PROCESS_REFUNDS: 'process_refunds',
  EXPORT_ORDERS: 'export_orders',
  EXPORT_OWN_ORDERS: 'export_own_orders',

  // System Administration
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_SYSTEM_SETTINGS: 'manage_system_settings',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_SECURITY_SETTINGS: 'manage_security_settings',
  ACCESS_DEBUG_TOOLS: 'access_debug_tools',
  VIEW_SYSTEM_HEALTH: 'view_system_health',
  FULL_ADMIN_ACCESS: 'full_admin_access',
  MANAGE_ROLES: 'manage_roles',
  SYSTEM_CONFIGURATION: 'system_configuration',

  // Payment Operations
  CREATE_PAYMENTS: 'create_payments',
  VIEW_PAYMENT_DETAILS: 'view_payment_details',
  MANAGE_PAYMENT_METHODS: 'manage_payment_methods',
  MANAGE_OWN_PAYMENT_METHODS: 'manage_own_payment_methods',
  PROCESS_BULK_PAYMENTS: 'process_bulk_payments',

  // Analytics
  VIEW_OWN_ANALYTICS: 'view_own_analytics',
  VIEW_PAYMENT_STATS: 'view_payment_stats',
  VIEW_BASIC_STATS: 'view_basic_stats',

  // Profile
  MANAGE_OWN_PROFILE: 'manage_own_profile',
  VIEW_OWN_AUDIT_LOGS: 'view_own_audit_logs',
  VIEW_PUBLIC_DATA: 'view_public_data',
  VIEW_OWN_PAYMENTS: 'view_own_payments',
} as const;

// Type for all permission strings
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Export role types for consistency
export type { UserRole } from '@/lib/types';
