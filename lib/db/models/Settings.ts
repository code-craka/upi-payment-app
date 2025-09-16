import mongoose, { Schema, type Document } from "mongoose"
import type { Settings } from "@/lib/types"

export interface SettingsDocument extends Omit<Settings, "id" | "updatedAt">, Document {
  updatedAt: Date
}

const SettingsSchema = new Schema<SettingsDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    description: String,
    updatedBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Static methods
SettingsSchema.statics.getValue = async function (key: string, defaultValue: any = null) {
  const setting = await this.findOne({ key })
  return setting ? setting.value : defaultValue
}

SettingsSchema.statics.setValue = async function (key: string, value: any, updatedBy: string, description?: string) {
  return this.findOneAndUpdate({ key }, { value, updatedBy, description }, { upsert: true, new: true })
}

export const SettingsModel = mongoose.models.Settings || mongoose.model<SettingsDocument>("Settings", SettingsSchema)
