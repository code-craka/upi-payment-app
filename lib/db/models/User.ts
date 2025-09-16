import mongoose, { Schema, type Document } from "mongoose"
import { mongooseSecurityPlugin, MONGOOSE_SECURITY_OPTIONS } from "@/lib/db/security"

export interface UserDocument extends Document {
  clerkId: string
  email: string
  name?: string
  role: "admin" | "merchant" | "viewer"
  isActive: boolean
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
  preferences: {
    theme: "light" | "dark" | "system"
    notifications: {
      email: boolean
      orderUpdates: boolean
      systemAlerts: boolean
    }
    defaultUpiId?: string
    defaultExpiryMinutes: number
  }
  stats: {
    totalOrders: number
    totalAmount: number
    successfulOrders: number
    lastOrderAt?: Date
  }
}

const UserSchema = new Schema<UserDocument>(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "Invalid email format",
      },
    },
    name: {
      type: String,
      maxlength: 100,
    },
    role: {
      type: String,
      enum: ["admin", "merchant", "viewer"],
      default: "merchant",
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
        enum: ["light", "dark", "system"],
        default: "system",
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
)

// Indexes for performance
UserSchema.index({ role: 1, isActive: 1 })
UserSchema.index({ "stats.totalOrders": -1 })
UserSchema.index({ lastLoginAt: -1 })

// Instance methods
UserSchema.methods.updateStats = async function (orderAmount: number, isSuccessful: boolean) {
  this.stats.totalOrders += 1
  this.stats.totalAmount += orderAmount
  if (isSuccessful) {
    this.stats.successfulOrders += 1
  }
  this.stats.lastOrderAt = new Date()
  return this.save()
}

UserSchema.methods.updateLastLogin = function () {
  this.lastLoginAt = new Date()
  return this.save()
}

// Static methods
UserSchema.statics.findByClerkId = function (clerkId: string) {
  return this.findOne({ clerkId, isActive: true })
}

UserSchema.statics.findActiveUsers = function (role?: string) {
  const query = { isActive: true }
  if (role) query.role = role
  return this.find(query).sort({ createdAt: -1 })
}

UserSchema.statics.getUserStats = function () {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
        totalOrders: { $sum: "$stats.totalOrders" },
        totalAmount: { $sum: "$stats.totalAmount" },
      },
    },
  ])
}

// Apply security plugin to prevent injection attacks
UserSchema.plugin(mongooseSecurityPlugin)

export const UserModel = mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema)
