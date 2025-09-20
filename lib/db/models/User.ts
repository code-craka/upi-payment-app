import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { mongooseSecurityPlugin } from '@/lib/db/security';

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  name?: string;
  role: 'admin' | 'merchant' | 'user';
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email: boolean;
      orderUpdates: boolean;
      systemAlerts: boolean;
    };
    defaultUpiId?: string;
    defaultExpiryMinutes: number;
  };
  stats: {
    totalOrders: number;
    totalAmount: number;
    successfulOrders: number;
    lastOrderAt?: Date;
  };
  // Instance methods
  updateStats(orderAmount: number, isSuccessful: boolean): Promise<UserDocument>;
  updateLastLogin(): Promise<UserDocument>;
  verifyPassword(password: string): Promise<boolean>;
}

export interface UserModelType extends Model<UserDocument> {
  findByEmail(email: string): Promise<UserDocument | null>;
  findActiveUsers(role?: string): Promise<UserDocument[]>;
  getUserStats(): Promise<Array<{
    _id: string;
    count: number;
    totalOrders: number;
    totalAmount: number;
  }>>;
  createUser(userData: {
    email: string;
    password: string;
    name?: string;
    role: 'admin' | 'merchant' | 'user';
  }): Promise<UserDocument>;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Invalid email format',
      },
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 60, // bcrypt hash length
    },
    name: {
      type: String,
      maxlength: 100,
    },
    role: {
      type: String,
      enum: ['admin', 'merchant', 'user'],
      default: 'user',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: Date,
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
      notifications: {
        email: { type: Boolean, default: true },
        orderUpdates: { type: Boolean, default: true },
        systemAlerts: { type: Boolean, default: true },
      },
      defaultUpiId: String,
      defaultExpiryMinutes: {
        type: Number,
        default: 9,
        min: 1,
        max: 60,
      },
    },
    stats: {
      totalOrders: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      successfulOrders: { type: Number, default: 0 },
      lastOrderAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for performance
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ 'stats.totalOrders': -1 });
UserSchema.index({ lastLoginAt: -1 });

// Instance methods with proper return types
UserSchema.methods.updateStats = async function (orderAmount: number, isSuccessful: boolean): Promise<UserDocument> {
  this.stats.totalOrders += 1;
  this.stats.totalAmount += orderAmount;
  if (isSuccessful) {
    this.stats.successfulOrders += 1;
  }
  this.stats.lastOrderAt = new Date();
  return this.save();
};

UserSchema.methods.updateLastLogin = function (): Promise<UserDocument> {
  this.lastLoginAt = new Date();
  return this.save();
};

UserSchema.methods.verifyPassword = async function (password: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.default.compare(password, this.passwordHash);
};

// Static methods with proper return types
UserSchema.statics.findByEmail = function (email: string): Promise<UserDocument | null> {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

UserSchema.statics.findActiveUsers = function (role?: string): Promise<UserDocument[]> {
  const query: { isActive: boolean; role?: string } = { isActive: true };
  if (role) query.role = role;
  return this.find(query).sort({ createdAt: -1 });
};

UserSchema.statics.getUserStats = function (): Promise<Array<{
  _id: string;
  count: number;
  totalOrders: number;
  totalAmount: number;
}>> {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        totalOrders: { $sum: '$stats.totalOrders' },
        totalAmount: { $sum: '$stats.totalAmount' },
      },
    },
  ]);
};

UserSchema.statics.createUser = async function (userData: {
  email: string;
  password: string;
  name?: string;
  role: 'admin' | 'merchant' | 'user';
}): Promise<UserDocument> {
  const bcrypt = await import('bcryptjs');

  const passwordHash = await bcrypt.default.hash(userData.password, 12);

  const user = new this({
    email: userData.email.toLowerCase(),
    passwordHash,
    name: userData.name,
    role: userData.role,
    isActive: true,
    preferences: {
      theme: 'system',
      notifications: {
        email: true,
        orderUpdates: true,
        systemAlerts: userData.role === 'admin',
      },
      defaultExpiryMinutes: 9,
    },
    stats: {
      totalOrders: 0,
      totalAmount: 0,
      successfulOrders: 0,
    },
  });

  return user.save();
};

// Apply security plugin to prevent injection attacks
UserSchema.plugin(mongooseSecurityPlugin);

// Safe model export for Edge Runtime compatibility (used by middleware)
export const UserModel = (() => {
  try {
    // Check if we're in Edge Runtime (middleware) - mongoose.models is undefined
    if (typeof mongoose.models === 'undefined') {
      // Return a mock for Edge Runtime - middleware shouldn't use the actual model
      return null as unknown as UserModelType;
    }

    // Regular Node.js runtime - safe to use mongoose.models
    return (mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema)) as UserModelType;
  } catch (error) {
    // Fallback for any mongoose initialization issues
    console.warn('[UserModel] Mongoose model initialization failed:', error);
    return null as unknown as UserModelType;
  }
})();
