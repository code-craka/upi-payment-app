import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { Settings } from '@/lib/types';

// Enhanced type for Settings value field
export interface SettingsValue {
  [key: string]: string | number | boolean | SettingsValue | SettingsValue[];
}

export interface SettingsDocument extends Omit<Settings, 'id' | 'updatedAt'>, Document {
  updatedAt: Date;
  value: SettingsValue;
}

export interface SettingsModelType extends Model<SettingsDocument> {
  getValue(key: string, defaultValue?: SettingsValue | null): Promise<SettingsValue | null>;
  setValue(key: string, value: SettingsValue, updatedBy: string, description?: string): Promise<SettingsDocument>;
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
      validate: {
        validator: (value: unknown): value is SettingsValue => {
          return value !== null && typeof value === 'object';
        },
        message: 'Settings value must be a valid object',
      },
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
);

// Static methods with strict typing
SettingsSchema.statics.getValue = async function (
  key: string,
  defaultValue: SettingsValue | null = null,
): Promise<SettingsValue | null> {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

SettingsSchema.statics.setValue = async function (
  key: string,
  value: SettingsValue,
  updatedBy: string,
  description?: string,
): Promise<SettingsDocument> {
  return this.findOneAndUpdate(
    { key },
    { value, updatedBy, description },
    { upsert: true, new: true },
  );
};

export const SettingsModel = (mongoose.models.Settings || mongoose.model<SettingsDocument>('Settings', SettingsSchema)) as SettingsModelType;
