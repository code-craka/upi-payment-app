import { z } from 'zod';

export const UserRoleSchema = z.enum(['admin', 'merchant', 'viewer']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const SafeUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: UserRoleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SafeUser = z.infer<typeof SafeUserSchema>;

export const OrderStatusSchema = z.enum([
  'pending',
  'pending-verification',
  'completed',
  'expired',
  'failed',
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  amount: z.number().positive(),
  description: z.string(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  upiId: z.string(),
  status: OrderStatusSchema,
  utrNumber: z.string().optional(),
  createdBy: z.string(),
  expiresAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
  verifiedAt: z.date().optional(),
  verifiedBy: z.string().optional(),
});

export type Order = z.infer<typeof OrderSchema>;

// Extended Order type for payment pages with additional UI fields
export const PaymentOrderSchema = OrderSchema.extend({
  merchantName: z.string().optional(),
  vpa: z.string().optional(),
  upiDeepLink: z.string().optional(),
  utr: z.string().optional(),
});

export type PaymentOrder = z.infer<typeof PaymentOrderSchema>;

// Extended Order type for table display with MongoDB _id and UI fields
export const OrderTableSchema = OrderSchema.extend({
  _id: z.string().optional(),
  merchantName: z.string().optional(),
  vpa: z.string().optional(),
  upiDeepLink: z.string().optional(),
  utr: z.string().optional(),
  paymentPageUrl: z.string().optional(),
});

export type OrderTable = z.infer<typeof OrderTableSchema>;

export const AuditLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  userId: z.string(),
  userEmail: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const SettingsSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.any(),
  description: z.string().optional(),
  updatedBy: z.string(),
  updatedAt: z.date(),
});

export type Settings = z.infer<typeof SettingsSchema>;

// Permission definitions
export const PERMISSIONS = {
  admin: [
    'create_user',
    'delete_user',
    'view_all_orders',
    'update_settings',
    'view_audit_logs',
    'verify_orders',
    'manage_roles',
  ],
  merchant: ['create_order', 'view_own_orders', 'manage_own_links', 'submit_utr'],
  viewer: ['view_assigned_orders'],
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS][number];

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const rolePermissions = PERMISSIONS[userRole] || [];
  return (rolePermissions as readonly Permission[]).includes(permission) || userRole === 'admin';
}

// Legacy interfaces for backward compatibility
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'merchant' | 'viewer';
  createdAt: Date;
  lastActive?: Date;
}

export interface SystemSettings {
  _id: string;
  timerDuration: number;
  staticUpiId?: string;
  enabledUpiApps: {
    gpay: boolean;
    phonepe: boolean;
    paytm: boolean;
    bhim: boolean;
  };
  updatedBy: string;
  updatedAt: Date;
}

export interface Analytics {
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  userStats: Array<{
    userId: string;
    userName: string;
    totalLinks: number;
    successfulOrders: number;
    successRate: number;
  }>;
  recentActivity: Array<{
    orderId: string;
    action: string;
    timestamp: Date;
    userId: string;
    userName: string;
  }>;
}

// Session Management Types
export const SessionDataSchema = z.object({
  role: UserRoleSchema,
  permissions: z.array(z.string()).optional(),
  updatedAt: z.date(),
});

export type SessionData = z.infer<typeof SessionDataSchema>;

export const SessionResponseSchema = z.object({
  userId: z.string(),
  role: UserRoleSchema.nullable(),
  permissions: z.array(z.string()).optional(),
  updatedAt: z.date().nullable(),
  hasSession: z.boolean(),
});

export type SessionResponse = z.infer<typeof SessionResponseSchema>;

// ==========================================
// HYBRID ROLE MANAGEMENT TYPES
// ==========================================

// Redis Session Data for hybrid role management
export const RedisSessionDataSchema = z.object({
  userId: z.string(),
  role: UserRoleSchema,
  lastSync: z.number(),
  clerkSync: z.boolean(),
  metadata: z.record(z.any()).optional(),
});

export type RedisSessionData = z.infer<typeof RedisSessionDataSchema>;

// Role Statistics for admin dashboard
export const RoleStatsSchema = z.object({
  admin: z.number().min(0),
  merchant: z.number().min(0),
  viewer: z.number().min(0),
  total: z.number().min(0),
  lastUpdated: z.number(),
});

export type RoleStats = z.infer<typeof RoleStatsSchema>;

// Role Sync Status for debugging
export const RoleSyncStatusSchema = z.object({
  userId: z.string(),
  clerkRole: UserRoleSchema.nullable(),
  redisRole: UserRoleSchema.nullable(),
  inSync: z.boolean(),
  lastClerkSync: z.number().nullable(),
  lastRedisSync: z.number().nullable(),
  syncError: z.string().optional(),
});

export type RoleSyncStatus = z.infer<typeof RoleSyncStatusSchema>;

// Session Hook State
export const SessionHookStateSchema = z.object({
  role: UserRoleSchema.nullable(),
  isLoading: z.boolean(),
  error: z.string().nullable(),
  lastRefresh: z.number(),
  isStale: z.boolean(),
  refreshCount: z.number(),
});

export type SessionHookState = z.infer<typeof SessionHookStateSchema>;

// Admin Bootstrap Request
export const AdminBootstrapRequestSchema = z.object({
  userEmail: z.string().email(),
  targetRole: UserRoleSchema,
  force: z.boolean().optional().default(false),
  reason: z.string().optional(),
});

export type AdminBootstrapRequest = z.infer<typeof AdminBootstrapRequestSchema>;

// Admin Bootstrap Response
export const AdminBootstrapResponseSchema = z.object({
  success: z.boolean(),
  userId: z.string().optional(),
  previousRole: UserRoleSchema.nullable(),
  newRole: UserRoleSchema,
  clerkUpdated: z.boolean(),
  redisUpdated: z.boolean(),
  message: z.string(),
  timestamp: z.number(),
});

export type AdminBootstrapResponse = z.infer<typeof AdminBootstrapResponseSchema>;

// Debug Session Response
export const DebugSessionResponseSchema = z.object({
  userId: z.string(),
  userEmail: z.string(),
  clerkData: z.object({
    role: UserRoleSchema.nullable(),
    publicMetadata: z.record(z.any()).optional(),
    lastUpdated: z.number().nullable(),
  }),
  redisData: z.object({
    cached: z.boolean(),
    role: UserRoleSchema.nullable(),
    lastSync: z.number().nullable(),
    sessionData: RedisSessionDataSchema.nullable(),
  }),
  synchronization: z.object({
    inSync: z.boolean(),
    discrepancy: z.string().optional(),
    recommendation: z.string().optional(),
  }),
  performance: z.object({
    clerkLatency: z.number().optional(),
    redisLatency: z.number().optional(),
    totalLatency: z.number(),
  }),
  timestamp: z.number(),
});

export type DebugSessionResponse = z.infer<typeof DebugSessionResponseSchema>;

// Role Change Event for audit logging
export const RoleChangeEventSchema = z.object({
  userId: z.string(),
  userEmail: z.string(),
  previousRole: UserRoleSchema.nullable(),
  newRole: UserRoleSchema,
  source: z.enum(['clerk', 'redis', 'bootstrap', 'manual']),
  triggeredBy: z.string(),
  reason: z.string().optional(),
  timestamp: z.number(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type RoleChangeEvent = z.infer<typeof RoleChangeEventSchema>;

// Enhanced Permission Check with Redis support
export interface HybridPermissionContext {
  userId: string;
  clerkRole?: UserRole;
  cachedRole?: UserRole;
  fallbackToClerk: boolean;
  maxCacheAge: number;
}

// Redis Connection Status
export const RedisConnectionStatusSchema = z.object({
  connected: z.boolean(),
  error: z.string().optional(),
  latency: z.number().optional(),
  lastTest: z.number(),
  uptime: z.number().optional(),
});

export type RedisConnectionStatus = z.infer<typeof RedisConnectionStatusSchema>;

// Hybrid Auth Context for middleware
export interface HybridAuthContext {
  userId: string;
  email: string;
  role: UserRole | null;
  source: 'clerk' | 'redis' | 'fallback';
  confidence: number; // 0-1, how confident we are in the role
  requiresSync: boolean;
  lastSync?: number;
}

// Role Management Event Types
export type RoleManagementEvent =
  | { type: 'role_assigned'; payload: RoleChangeEvent }
  | { type: 'role_cached'; payload: { userId: string; role: UserRole; ttl: number } }
  | { type: 'role_invalidated'; payload: { userId: string; reason: string } }
  | { type: 'sync_failed'; payload: { userId: string; error: string } }
  | { type: 'cache_miss'; payload: { userId: string; fallback: 'clerk' | 'default' } }
  | { type: 'cache_hit'; payload: { userId: string; role: UserRole; age: number } };

// Hook Options for useSessionRole
export interface UseSessionRoleOptions {
  refreshInterval?: number; // milliseconds, default 30000
  maxStaleTime?: number; // milliseconds, default 60000
  fallbackRole?: UserRole; // default role if everything fails
  enableAutoRefresh?: boolean; // default true
  onRoleChange?: (oldRole: UserRole | null, newRole: UserRole | null) => void;
  onError?: (error: Error) => void;
}
