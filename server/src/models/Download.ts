import mongoose, { Document, Schema, Types } from 'mongoose';
import { env } from '../config/env.js';

export interface IDownload {
  release: Types.ObjectId;
  application: Types.ObjectId;
  os: 'windows' | 'linux' | 'macos';
  architecture: 'x64' | 'arm64' | 'universal';
  format: 'exe' | 'msi' | 'zip' | 'deb' | 'appimage' | 'rpm' | 'dmg' | 'pkg' | 'tar.gz';
  storageProvider: 'r2' | 'external';
  r2Key?: string;
  r2Bucket?: string;
  externalUrl?: string;
  fileName: string;
  fileSize: number;
  sha256Checksum?: string;
  checksumVerified: boolean;
  mimeType?: string;
  downloadUrl?: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'published' | 'disabled' | 'failed';
  uploadId?: string;
  uploadProgress: number;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDownloadDocument extends IDownload, Document {
  getComputedDownloadUrl(): string;
}

const DownloadSchema = new Schema<IDownloadDocument>(
  {
    release: {
      type: Schema.Types.ObjectId,
      ref: 'Release',
      required: true,
      index: true,
    },
    application: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    os: {
      type: String,
      enum: ['windows', 'linux', 'macos'],
      required: true,
    },
    architecture: {
      type: String,
      enum: ['x64', 'arm64', 'universal'],
      required: true,
    },
    format: {
      type: String,
      enum: ['exe', 'msi', 'zip', 'deb', 'appimage', 'rpm', 'dmg', 'pkg', 'tar.gz'],
      required: true,
    },
    storageProvider: {
      type: String,
      enum: ['r2', 'external'],
      required: true,
      default: 'r2',
    },
    r2Key: { type: String },
    r2Bucket: { type: String, default: env.R2_STAGING_BUCKET_NAME },
    externalUrl: { type: String },
    fileName: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    sha256Checksum: { type: String },
    checksumVerified: { type: Boolean, default: false },
    mimeType: { type: String },
    downloadUrl: { type: String },
    status: {
      type: String,
      enum: ['pending', 'uploading', 'uploaded', 'published', 'disabled', 'failed'],
      default: 'pending',
      index: true,
    },
    uploadId: { type: String },
    uploadProgress: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

DownloadSchema.methods.getComputedDownloadUrl = function (): string {
  if (this.storageProvider === 'external' && this.externalUrl) {
    return this.externalUrl;
  }
  if (this.r2Key) {
    const base = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '');
    const key = this.r2Key.replace(/^\/+/, '');
    return `${base}/${key}`;
  }
  return this.downloadUrl || '';
};

DownloadSchema.virtual('publicDownloadUrl').get(function (this: IDownloadDocument) {
  return this.getComputedDownloadUrl();
});

DownloadSchema.pre('save', function (next) {
  this.downloadUrl = this.getComputedDownloadUrl();
  next();
});

export const Download = mongoose.model<IDownloadDocument>('Download', DownloadSchema);
