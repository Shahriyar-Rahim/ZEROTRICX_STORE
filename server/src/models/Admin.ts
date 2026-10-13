import mongoose, { Document, Model, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

export interface IAdmin {
  username: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string;
  role: 'superadmin' | 'admin';
  twoFactorEnabled: boolean;
  twoFactorCodeHash?: string;
  twoFactorCodeExpiresAt?: Date;
  emailVerificationCodeHash?: string;
  emailVerificationExpiresAt?: Date;
  pendingEmail?: string;
  emailChangeCodeHash?: string;
  emailChangeCodeExpiresAt?: Date;
  lastLogin?: Date;
  loginAttempts: number;
  sessionVersion: number;
  lockUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAdminDocument extends IAdmin, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  isLocked(): boolean;
}

export interface IAdminModel extends Model<IAdminDocument> {
  incrementLoginAttempts(id: string): Promise<void>;
  resetLoginAttempts(id: string): Promise<void>;
}

const AdminSchema = new Schema<IAdminDocument, IAdminModel>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    emailVerified: { type: Boolean, default: false },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin'],
      default: 'admin',
      required: true,
    },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorCodeHash: { type: String, select: false },
    twoFactorCodeExpiresAt: { type: Date, select: false },
    emailVerificationCodeHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    pendingEmail: { type: String, select: false },
    emailChangeCodeHash: { type: String, select: false },
    emailChangeCodeExpiresAt: { type: Date, select: false },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      required: true,
      default: 0,
    },
    sessionVersion: {
      type: Number,
      required: true,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

AdminSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

AdminSchema.methods.isLocked = function (): boolean {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

AdminSchema.statics.incrementLoginAttempts = async function (id: string): Promise<void> {
  const admin = await this.findById(id);
  if (!admin) return;

  const now = new Date();
  // If lock expired, reset attempts to 1 and remove lock
  if (admin.lockUntil && admin.lockUntil.getTime() < now.getTime()) {
    await this.findByIdAndUpdate(id, {
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
    return;
  }

  const updates: Record<string, any> = {
    $inc: { loginAttempts: 1 },
  };

  // If next attempt hits limit and not already locked
  if (admin.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !admin.isLocked()) {
    updates.$set = { lockUntil: new Date(now.getTime() + LOCK_TIME_MS) };
  }

  await this.findByIdAndUpdate(id, updates);
};

AdminSchema.statics.resetLoginAttempts = async function (id: string): Promise<void> {
  await this.findByIdAndUpdate(id, {
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 },
  });
};

export const Admin = mongoose.model<IAdminDocument, IAdminModel>('Admin', AdminSchema);
