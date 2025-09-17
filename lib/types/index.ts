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
