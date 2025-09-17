import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { AuditLog } from '@/lib/types';

// Enhanced type for AuditLog metadata field
export interface AuditLogMetadata {
  [key: string]: string | number | boolean | Date | AuditLogMetadata | AuditLogMetadata[] | null | undefined;
}

export interface AuditLogDocument extends Omit<AuditLog, 'id' | 'createdAt'>, Document {
  createdAt: Date;
  metadata?: AuditLogMetadata;
}

export interface AuditLogModelType extends Model<AuditLogDocument> {
  // Add static methods here if needed in the future
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
      validate: {
        validator: (value: unknown): value is AuditLogMetadata | undefined => {
          return value === undefined || (value !== null && typeof value === 'object');
        },
        message: 'Metadata must be a valid object or undefined',
      },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for performance
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLogModel = (mongoose.models.AuditLog || mongoose.model<AuditLogDocument>('AuditLog', AuditLogSchema)) as AuditLogModelType;
