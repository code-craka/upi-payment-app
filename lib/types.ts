import { z } from "zod"

export const UserRoleSchema = z.enum(["admin", "merchant", "viewer"])
export type UserRole = z.infer<typeof UserRoleSchema>

export const SafeUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: UserRoleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type SafeUser = z.infer<typeof SafeUserSchema>

export const OrderStatusSchema = z.enum(["pending", "pending-verification", "completed", "expired", "failed"])

export type OrderStatus = z.infer<typeof OrderStatusSchema>

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
})

export type Order = z.infer<typeof OrderSchema>

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
})

export type AuditLog = z.infer<typeof AuditLogSchema>

export const SettingsSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.any(),
  description: z.string().optional(),
  updatedBy: z.string(),
  updatedAt: z.date(),
})

export type Settings = z.infer<typeof SettingsSchema>

// Permission definitions
export const PERMISSIONS = {
  admin: [
    "create_user",
    "delete_user",
    "view_all_orders",
    "update_settings",
    "view_audit_logs",
    "verify_orders",
    "manage_roles",
  ],
  merchant: ["create_order", "view_own_orders", "manage_own_links", "submit_utr"],
  viewer: ["view_assigned_orders"],
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS][number]

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const rolePermissions = PERMISSIONS[userRole] || []
  return (rolePermissions as readonly Permission[]).includes(permission) || userRole === "admin"
}

// Legacy interfaces for backward compatibility
export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role: "admin" | "merchant" | "viewer"
  createdAt: Date
  lastActive?: Date
}

export interface SystemSettings {
  _id: string
  timerDuration: number
  staticUpiId?: string
  enabledUpiApps: {
    gpay: boolean
    phonepe: boolean
    paytm: boolean
    bhim: boolean
  }
  updatedBy: string
  updatedAt: Date
}

export interface Analytics {
  totalOrders: number
  ordersByStatus: Record<string, number>
  userStats: Array<{
    userId: string
    userName: string
    totalLinks: number
    successfulOrders: number
    successRate: number
  }>
  recentActivity: Array<{
    orderId: string
    action: string
    timestamp: Date
    userId: string
    userName: string
  }>
}

// Session Management Types
export const SessionDataSchema = z.object({
  role: UserRoleSchema,
  permissions: z.array(z.string()).optional(),
  updatedAt: z.date(),
})

export type SessionData = z.infer<typeof SessionDataSchema>

export const SessionResponseSchema = z.object({
  userId: z.string(),
  role: UserRoleSchema.nullable(),
  permissions: z.array(z.string()).optional(),
  updatedAt: z.date().nullable(),
  hasSession: z.boolean(),
})

export type SessionResponse = z.infer<typeof SessionResponseSchema>
