import mongoose, { Schema, type Document } from "mongoose"
import type { AuditLog } from "@/lib/types"

export interface AuditLogDocument extends Omit<AuditLog, "id" | "createdAt">, Document {
  createdAt: Date
}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes for performance
AuditLogSchema.index({ userId: 1, createdAt: -1 })
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })
AuditLogSchema.index({ action: 1, createdAt: -1 })

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model<AuditLogDocument>("AuditLog", AuditLogSchema)
