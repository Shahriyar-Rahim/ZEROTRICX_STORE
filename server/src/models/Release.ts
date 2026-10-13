import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRelease {
  application: Types.ObjectId;
  version: string;
  releaseDate: Date;
  changelog?: string;
  releaseType: 'stable' | 'beta' | 'alpha';
  status: 'draft' | 'published' | 'archived';
  minimumRequirements: {
    windows?: string;
    linux?: string;
    macos?: string;
  };
  knownIssues: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IReleaseDocument extends IRelease, Document {}

const ReleaseSchema = new Schema<IReleaseDocument>(
  {
    application: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
    },
    releaseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    changelog: {
      type: String,
      default: '',
    },
    releaseType: {
      type: String,
      enum: ['stable', 'beta', 'alpha'],
      default: 'stable',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      required: true,
      index: true,
    },
    minimumRequirements: {
      windows: { type: String, default: '' },
      linux: { type: String, default: '' },
      macos: { type: String, default: '' },
    },
    knownIssues: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

ReleaseSchema.index({ application: 1, version: 1 }, { unique: true });

export const Release = mongoose.model<IReleaseDocument>('Release', ReleaseSchema);
