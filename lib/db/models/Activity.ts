import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ActivityDocument extends Document {
  type: 'user_registered' | 'payment_link_created' | 'payment_completed' | 'payment_failed' | 'user_updated' | 'user_deleted' | 'system_backup' | 'system_maintenance';
  title: string;
  description?: string;
  userId?: string;
  userName?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
  icon?: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityModelType extends Model<ActivityDocument> {
  getRecentActivities(limit?: number): Promise<ActivityDocument[]>;
  logActivity(data: Partial<ActivityDocument>): Promise<ActivityDocument>;
}

const ActivitySchema = new Schema<ActivityDocument>(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'user_registered',
        'payment_link_created',
        'payment_completed',
        'payment_failed',
        'user_updated',
        'user_deleted',
        'system_backup',
        'system_maintenance'
      ],
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    userId: {
      type: String,
      index: true,
    },
    userName: {
      type: String,
    },
    amount: {
      type: Number,
      min: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    icon: {
      type: String,
      default: 'activity',
    },
    color: {
      type: String,
      default: 'blue',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
ActivitySchema.index({ createdAt: -1 });
ActivitySchema.index({ type: 1, createdAt: -1 });
ActivitySchema.index({ userId: 1, createdAt: -1 });

// Static methods
ActivitySchema.statics.getRecentActivities = function(limit: number = 50): Promise<ActivityDocument[]> {
  return this.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

ActivitySchema.statics.logActivity = function(data: Partial<ActivityDocument>): Promise<ActivityDocument> {
  const activity = new this(data);
  return activity.save();
};

export const ActivityModel = (mongoose.models.Activity ||
  mongoose.model<ActivityDocument>('Activity', ActivitySchema)) as ActivityModelType;