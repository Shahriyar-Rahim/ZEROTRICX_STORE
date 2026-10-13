import mongoose, { Document, Schema } from 'mongoose';

export interface IApplicationScreenshot {
  key: string;
  url: string;
  caption?: string;
  order: number;
}

export interface ISupportedPlatform {
  os: 'windows' | 'linux' | 'macos';
  architectures: ('x64' | 'arm64')[];
  minRequirements?: string;
}

export interface IApplication {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  icon?: {
    key: string;
    url: string;
    mimeType?: string;
  };
  screenshots: IApplicationScreenshot[];
  category: string;
  features: string[];
  supportedPlatforms: ISupportedPlatform[];
  license?: string;
  supportUrl?: string;
  websiteUrl?: string;
  githubUrl?: string;
  privacyPolicyUrl?: string;
  status: 'draft' | 'published' | 'archived';
  isFeatured: boolean;
  isPinned: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords: string[];
  installationInstructions: {
    windows?: string;
    linux?: string;
    macos?: string;
  };
  currentVersion?: string;
  totalDownloads: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IApplicationDocument extends IApplication, Document {}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

const ApplicationSchema = new Schema<IApplicationDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    shortDescription: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      key: { type: String },
      url: { type: String },
      mimeType: { type: String },
    },
    screenshots: [
      {
        key: { type: String, required: true },
        url: { type: String, required: true },
        caption: { type: String, default: '' },
        order: { type: Number, default: 0 },
      },
    ],
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    features: [{ type: String }],
    supportedPlatforms: [
      {
        os: {
          type: String,
          enum: ['windows', 'linux', 'macos'],
          required: true,
        },
        architectures: [
          {
            type: String,
            enum: ['x64', 'arm64'],
          },
        ],
        minRequirements: { type: String },
      },
    ],
    license: { type: String },
    supportUrl: { type: String },
    websiteUrl: { type: String },
    githubUrl: { type: String },
    privacyPolicyUrl: { type: String },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPinned: { type: Boolean, default: false, index: true },
    seoTitle: { type: String },
    seoDescription: { type: String },
    seoKeywords: [{ type: String }],
    installationInstructions: {
      windows: { type: String, default: '' },
      linux: { type: String, default: '' },
      macos: { type: String, default: '' },
    },
    currentVersion: { type: String },
    totalDownloads: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

ApplicationSchema.index({ name: 'text', description: 'text', shortDescription: 'text' });

ApplicationSchema.pre('validate', function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  } else if (this.slug) {
    this.slug = slugify(this.slug);
  }
  next();
});

export const Application = mongoose.model<IApplicationDocument>('Application', ApplicationSchema);
