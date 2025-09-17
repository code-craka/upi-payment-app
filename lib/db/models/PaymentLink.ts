import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface PaymentLinkDocument extends Document {
  linkId: string;
  title: string;
  description?: string;
  amount?: number;
  allowCustomAmount: boolean;
  minAmount?: number;
  maxAmount?: number;
  upiId: string;
  createdBy: string;
  isActive: boolean;
  expiresAt?: Date;
  usageLimit?: number;
  usageCount: number;
  customFields: Array<{
    name: string;
    type: 'text' | 'email' | 'phone' | 'number';
    required: boolean;
    placeholder?: string;
  }>;
  settings: {
    collectCustomerInfo: boolean;
    sendEmailReceipt: boolean;
    redirectUrl?: string;
    webhookUrl?: string;
  };
  stats: {
    totalOrders: number;
    successfulOrders: number;
    totalAmount: number;
    lastUsedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  isExpired(): boolean;
  canBeUsed(): boolean;
  incrementUsage(amount: number, isSuccessful: boolean): Promise<PaymentLinkDocument>;
}

export interface PaymentLinkModelType extends Model<PaymentLinkDocument> {
  findByLinkId(linkId: string): Promise<PaymentLinkDocument | null>;
  findActiveLinks(userId: string): Promise<PaymentLinkDocument[]>;
}

const PaymentLinkSchema = new Schema<PaymentLinkDocument>(
  {
    linkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    amount: {
      type: Number,
      min: 1,
    },
    allowCustomAmount: {
      type: Boolean,
      default: false,
    },
    minAmount: {
      type: Number,
      min: 1,
    },
    maxAmount: {
      type: Number,
      min: 1,
    },
    upiId: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^[\w.-]+@[\w.-]+$/.test(v),
        message: "Invalid UPI ID format",
      },
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    usageLimit: {
      type: Number,
      min: 1,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    customFields: [
      {
        name: { type: String, required: true },
        type: {
          type: String,
          enum: ["text", "email", "phone", "number"],
          required: true,
        },
        required: { type: Boolean, default: false },
        placeholder: String,
      },
    ],
    settings: {
      collectCustomerInfo: { type: Boolean, default: true },
      sendEmailReceipt: { type: Boolean, default: false },
      redirectUrl: String,
      webhookUrl: String,
    },
    stats: {
      totalOrders: { type: Number, default: 0 },
      successfulOrders: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      lastUsedAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes for performance
PaymentLinkSchema.index({ createdBy: 1, isActive: 1 })
PaymentLinkSchema.index({ isActive: 1, expiresAt: 1 })

// Virtual for public URL
PaymentLinkSchema.virtual("publicUrl").get(function () {
  return `/link/${this.linkId}`
})

// Instance methods
PaymentLinkSchema.methods.isExpired = function (): boolean {
  return this.expiresAt ? new Date() > this.expiresAt : false
}

PaymentLinkSchema.methods.canBeUsed = function (): boolean {
  if (!this.isActive || this.isExpired()) return false
  if (this.usageLimit && this.usageCount >= this.usageLimit) return false
  return true
}

PaymentLinkSchema.methods.incrementUsage = function (amount: number, isSuccessful: boolean): Promise<PaymentLinkDocument> {
  this.usageCount += 1;
  this.stats.totalOrders += 1;
  this.stats.totalAmount += amount;
  if (isSuccessful) {
    this.stats.successfulOrders += 1;
  }
  this.stats.lastUsedAt = new Date();
  return this.save();
};

// Static methods with proper return types
PaymentLinkSchema.statics.findByLinkId = function (linkId: string): Promise<PaymentLinkDocument | null> {
  return this.findOne({ linkId, isActive: true });
};

PaymentLinkSchema.statics.findActiveLinks = function (userId: string): Promise<PaymentLinkDocument[]> {
  return this.find({
    createdBy: userId,
    isActive: true,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
  }).sort({ createdAt: -1 });
};

export const PaymentLinkModel = (mongoose.models.PaymentLink ||
  mongoose.model<PaymentLinkDocument>('PaymentLink', PaymentLinkSchema)) as PaymentLinkModelType;
