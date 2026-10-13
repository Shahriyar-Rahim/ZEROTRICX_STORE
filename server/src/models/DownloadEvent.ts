import mongoose, { Document, Schema, Types } from 'mongoose';
import { env } from '../config/env.js';

export interface IDownloadEvent {
  download: Types.ObjectId;
  application: Types.ObjectId;
  release: Types.ObjectId;
  os: string;
  format: string;
  architecture: string;
  timestamp: Date;
  userAgent?: string;
  country?: string;
  sessionId?: string;
  createdAt: Date;
}

export interface IDownloadEventDocument extends IDownloadEvent, Document {}

const DownloadEventSchema = new Schema<IDownloadEventDocument>(
  {
    download: {
      type: Schema.Types.ObjectId,
      ref: 'Download',
      required: true,
      index: true,
    },
    application: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    release: {
      type: Schema.Types.ObjectId,
      ref: 'Release',
      required: true,
      index: true,
    },
    os: {
      type: String,
      required: true,
      index: true,
    },
    format: {
      type: String,
      required: true,
    },
    architecture: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    userAgent: {
      type: String,
    },
    country: {
      type: String,
    },
    sessionId: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes for analytics aggregations
DownloadEventSchema.index({ application: 1, timestamp: -1 });
DownloadEventSchema.index({ os: 1, timestamp: -1 });
DownloadEventSchema.index({ timestamp: -1, application: 1 });

// TTL index to automatically clean up events older than ANALYTICS_RETENTION_DAYS
const ttlSeconds = env.ANALYTICS_RETENTION_DAYS * 24 * 60 * 60;
DownloadEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: ttlSeconds });

export const DownloadEvent = mongoose.model<IDownloadEventDocument>('DownloadEvent', DownloadEventSchema);
