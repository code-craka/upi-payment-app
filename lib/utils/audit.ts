import { AuditLogModel } from "@/lib/db/models/AuditLog"
import { connectDB } from "@/lib/db/connection"
import { headers } from "next/headers"
import { type NextRequest } from "next/server"

export async function createAuditLog({
  action,
  entityType,
  entityId,
  userId,
  userEmail,
  ipAddress,
  userAgent,
  metadata = {},
}: {
  action: string
  entityType: string
  entityId: string
  userId: string
  userEmail: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
}) {
  try {
    await connectDB()

    // Get headers if not provided
    let finalIpAddress = ipAddress
    let finalUserAgent = userAgent

    if (!finalIpAddress || !finalUserAgent) {
      const headersList = await headers()
      finalIpAddress = finalIpAddress || headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown"
      finalUserAgent = finalUserAgent || headersList.get("user-agent") || "unknown"
    }

    const auditLog = new AuditLogModel({
      action,
      entityType,
      entityId,
      userId,
      userEmail,
      ipAddress: finalIpAddress,
      userAgent: finalUserAgent,
      metadata,
    })

    await auditLog.save()
    console.log(`[AUDIT] ${action} on ${entityType}:${entityId} by ${userEmail}`)
  } catch (error) {
    console.error("Failed to create audit log:", error)
    // Don't throw - audit logging shouldn't break the main flow
  }
}

/**
 * Create audit log from NextRequest
 */
export async function createAuditLogFromRequest(
  request: NextRequest,
  action: string,
  entityType: string,
  entityId: string,
  userId: string,
  userEmail?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const ipAddress = getClientIPFromRequest(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  await createAuditLog({
    action,
    entityType,
    entityId,
    userId,
    userEmail: userEmail || '',
    ipAddress,
    userAgent,
    metadata,
  })
}

/**
 * Get client IP address from request
 */
export function getClientIPFromRequest(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")
  const cfConnectingIP = request.headers.get("cf-connecting-ip")

  if (cfConnectingIP) {
    return cfConnectingIP
  }

  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }

  if (realIP) {
    return realIP
  }

  return request.ip || "unknown"
}

/**
 * Log security events
 */
export async function logSecurityEvent(
  request: NextRequest,
  eventType: 'rate_limit_exceeded' | 'csrf_token_invalid' | 'authentication_failure' | 'authorization_failure',
  metadata?: Record<string, any>
): Promise<void> {
  const ipAddress = getClientIPFromRequest(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  await createAuditLog({
    action: eventType,
    entityType: 'Security',
    entityId: 'system',
    userId: 'system',
    userEmail: 'system@security.com',
    ipAddress,
    userAgent,
    metadata: {
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  })
}

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs(filters?: {
  action?: string
  entityType?: string
  userId?: string
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
}) {
  await connectDB()
  
  const query: any = {}
  
  if (filters?.action) {
    query.action = { $regex: filters.action, $options: 'i' }
  }
  
  if (filters?.entityType) {
    query.entityType = filters.entityType
  }
  
  if (filters?.userId) {
    query.userId = filters.userId
  }
  
  if (filters?.startDate || filters?.endDate) {
    query.createdAt = {}
    if (filters.startDate) {
      query.createdAt.$gte = filters.startDate
    }
    if (filters.endDate) {
      query.createdAt.$lte = filters.endDate
    }
  }
  
  const page = filters?.page || 1
  const limit = filters?.limit || 50
  const skip = (page - 1) * limit
  
  const [logs, total] = await Promise.all([
    AuditLogModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLogModel.countDocuments(query),
  ])
  
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

export const AUDIT_ACTIONS = {
  // User actions
  USER_CREATED: "user_created",
  USER_UPDATED: "user_updated",
  USER_DELETED: "user_deleted",
  USER_ROLE_CHANGED: "user_role_changed",

  // Order actions
  ORDER_CREATED: "order_created",
  ORDER_UPDATED: "order_updated",
  ORDER_UTR_SUBMITTED: "order_utr_submitted",
  ORDER_VERIFIED: "order_verified",
  ORDER_EXPIRED: "order_expired",
  ORDER_FAILED: "order_failed",

  // Settings actions
  SETTINGS_UPDATED: "settings_updated",

  // Auth actions
  LOGIN: "login",
  LOGOUT: "logout",

  // Admin actions
  ADMIN_ACCESS: "admin_access",
  BULK_ACTION: "bulk_action",

  // Security actions
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  CSRF_TOKEN_INVALID: "csrf_token_invalid",
  AUTHENTICATION_FAILURE: "authentication_failure",
  AUTHORIZATION_FAILURE: "authorization_failure",

  // Webhook actions
  WEBHOOK_RECEIVED: "webhook_received",
  PAYMENT_CONFIRMED: "payment_confirmed",
  PAYMENT_FAILED: "payment_failed",
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]
