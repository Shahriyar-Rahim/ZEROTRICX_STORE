import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IStoreSettings {
  storeName: string;
  storeDescription: string;
  logo?: {
    key: string;
    url: string;
  };
  favicon?: {
    key: string;
    url: string;
  };
  contactEmail?: string;
  supportUrl?: string;
  socialLinks: {
    github?: string;
    twitter?: string;
    discord?: string;
    youtube?: string;
  };
  seoDefaults: {
    title: string;
    description: string;
    keywords: string[];
  };
  downloadDomain?: string;
  analyticsEnabled: boolean;
  maintenanceMode: boolean;
  footerText?: string;
  updatedAt: Date;
}

export interface IStoreSettingsDocument extends IStoreSettings, Document {}

export interface IStoreSettingsModel extends Model<IStoreSettingsDocument> {
  getSettings(): Promise<IStoreSettingsDocument>;
}

const StoreSettingsSchema = new Schema<IStoreSettingsDocument, IStoreSettingsModel>(
  {
    storeName: {
      type: String,
      default: 'ZEROTRICX Software',
      required: true,
      trim: true,
    },
    storeDescription: {
      type: String,
      default: 'Official software download portal',
      trim: true,
    },
    logo: {
      key: { type: String },
      url: { type: String },
    },
    favicon: {
      key: { type: String },
      url: { type: String },
    },
    contactEmail: { type: String, trim: true },
    supportUrl: { type: String, trim: true },
    socialLinks: {
      github: { type: String, default: '' },
      twitter: { type: String, default: '' },
      discord: { type: String, default: '' },
      youtube: { type: String, default: '' },
    },
    seoDefaults: {
      title: { type: String, default: 'ZEROTRICX Software - Download verified software' },
      description: { type: String, default: 'Browse and download verified software securely.' },
      keywords: { type: [String], default: ['software', 'download', 'apps'] },
    },
    downloadDomain: { type: String },
    analyticsEnabled: {
      type: Boolean,
      default: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    footerText: {
      type: String,
      default: '© All rights reserved.',
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
  }
);

StoreSettingsSchema.statics.getSettings = async function (): Promise<IStoreSettingsDocument> {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export const StoreSettings = mongoose.model<IStoreSettingsDocument, IStoreSettingsModel>(
  'StoreSettings',
  StoreSettingsSchema
);
