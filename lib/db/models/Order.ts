import mongoose, { Schema, type Document } from "mongoose"
import type { Order } from "@/lib/types"

export interface OrderDocument
  extends Omit<Order, "id" | "createdAt" | "updatedAt" | "expiresAt" | "verifiedAt">,
    Document {
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
  verifiedAt?: Date
}

const OrderSchema = new Schema<OrderDocument>(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    customerName: {
      type: String,
      maxlength: 100,
    },
    customerEmail: {
      type: String,
      validate: {
        validator: (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: "Invalid email format",
      },
    },
    customerPhone: {
      type: String,
      validate: {
        validator: (v: string) => !v || /^[+]?[\d\s-()]{10,15}$/.test(v),
        message: "Invalid phone format",
      },
    },
    upiId: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => /^[\w.-]+@[\w.-]+$/.test(v),
        message: "Invalid UPI ID format",
      },
    },
    status: {
      type: String,
      enum: ["pending", "pending-verification", "completed", "expired", "failed"],
      default: "pending",
      index: true,
    },
    utrNumber: {
      type: String,
      validate: {
        validator: (v: string) => !v || /^[A-Z0-9]{12}$/.test(v),
        message: "Invalid UTR format",
      },
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    verifiedAt: Date,
    verifiedBy: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes for performance
OrderSchema.index({ createdBy: 1, createdAt: -1 })
OrderSchema.index({ status: 1, expiresAt: 1 })
OrderSchema.index({ utrNumber: 1 }, { sparse: true })

// Instance methods
OrderSchema.methods.isExpired = function (): boolean {
  return new Date() > this.expiresAt && this.status === "pending"
}

OrderSchema.methods.canBeVerified = function (): boolean {
  return this.status === "pending-verification" && this.utrNumber
}

// Static methods
OrderSchema.statics.findByOrderId = function (orderId: string) {
  return this.findOne({ orderId })
}

OrderSchema.statics.findActiveOrders = function (userId: string) {
  return this.find({
    createdBy: userId,
    status: { $in: ["pending", "pending-verification"] },
  }).sort({ createdAt: -1 })
}

OrderSchema.statics.findExpiredOrders = function () {
  return this.find({
    status: "pending",
    expiresAt: { $lt: new Date() },
  })
}

OrderSchema.pre("save", function (next) {
  // Auto-expire orders that are past expiration
  if (this.status === "pending" && new Date() > this.expiresAt) {
    this.status = "expired"
  }
  next()
})

OrderSchema.virtual("paymentLink").get(function () {
  return `/pay/${this.orderId}`
})

OrderSchema.virtual("timeRemaining").get(function () {
  if (this.status !== "pending") return 0
  const now = new Date()
  const remaining = this.expiresAt.getTime() - now.getTime()
  return Math.max(0, remaining)
})

OrderSchema.statics.getOrderStats = function (userId?: string) {
  const match = userId ? { createdBy: userId } : {}
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ])
}

OrderSchema.statics.getRecentOrders = function (userId?: string, limit = 10) {
  const match = userId ? { createdBy: userId } : {}
  return this.find(match).sort({ createdAt: -1 }).limit(limit).populate("createdBy", "email name")
}

OrderSchema.statics.markExpiredOrders = async function () {
  const result = await this.updateMany(
    {
      status: "pending",
      expiresAt: { $lt: new Date() },
    },
    { status: "expired" },
  )
  return result.modifiedCount
}

export const OrderModel = mongoose.models.Order || mongoose.model<OrderDocument>("Order", OrderSchema)
