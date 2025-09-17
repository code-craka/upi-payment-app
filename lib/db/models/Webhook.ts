import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface WebhookDocument extends Document {
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
  createdBy: string;
  lastTriggeredAt?: Date;
  stats: {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
  };
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  recordAttempt(success: boolean): Promise<WebhookDocument>;
}

export interface WebhookModelType extends Model<WebhookDocument> {
  // Add static methods here if needed in the future
}

const WebhookSchema = new Schema<WebhookDocument>(
  {
    url: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^https?:\/\/.+/.test(v),
        message: 'Invalid URL format',
      },
    },
    events: [
      {
        type: String,
        enum: [
          'order.created',
          'order.utr_submitted',
          'order.completed',
          'order.failed',
          'order.expired',
          'payment_link.used',
        ],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    secret: {
      type: String,
      required: true,
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    lastTriggeredAt: Date,
    stats: {
      totalAttempts: { type: Number, default: 0 },
      successfulAttempts: { type: Number, default: 0 },
      failedAttempts: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
WebhookSchema.index({ createdBy: 1, isActive: 1 });

// Instance methods with proper return types
WebhookSchema.methods.recordAttempt = function (success: boolean): Promise<WebhookDocument> {
  this.stats.totalAttempts += 1;
  if (success) {
    this.stats.successfulAttempts += 1;
  } else {
    this.stats.failedAttempts += 1;
  }
  this.lastTriggeredAt = new Date();
  return this.save();
};

export const WebhookModel = (mongoose.models.Webhook || mongoose.model<WebhookDocument>('Webhook', WebhookSchema)) as WebhookModelType;
