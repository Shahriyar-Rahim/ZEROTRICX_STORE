import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Admin, IAdminDocument } from '../models/Admin.js';
import { env } from '../config/env.js';
import { auditService } from '../services/auditService.js';
import { emailService } from '../services/emailService.js';
import { AUTH_COOKIE_NAME } from '../middleware/auth.js';
import { ChangePasswordInput, LoginInput } from '../validators/auth.js';

const CODE_TTL_MS = 10 * 60 * 1000;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function matchesCode(code: string, storedHash?: string, expiresAt?: Date): boolean {
  if (!storedHash || !expiresAt || expiresAt.getTime() <= Date.now()) return false;
  const candidate = Buffer.from(hashCode(code), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export class AuthController {
  private setSessionCookie(res: Response, admin: { _id: { toString(): string }; username: string; email: string; role: string; sessionVersion: number }): void {
    const token = jwt.sign({
      id: admin._id.toString(),
      username: admin.username,
      email: admin.email,
      role: admin.role,
      sessionVersion: admin.sessionVersion,
    }, env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    });
  }

  private clearSessionCookie(res: Response): void {
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    });
  }

  private async completeLogin(admin: IAdminDocument | null, req: Request, res: Response): Promise<void> {
    if (!admin) return;
    this.setSessionCookie(res, admin);
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    await auditService.log(admin._id.toString(), 'auth.login', 'admin', admin._id.toString(), { username: admin.username }, ipAddress);
    res.status(200).json({
      success: true,
      data: {
        twoFactorRequired: false,
        admin: {
          id: admin._id.toString(),
          username: admin.username,
          email: admin.email,
          emailVerified: admin.emailVerified,
          twoFactorEnabled: admin.twoFactorEnabled,
          role: admin.role,
          lastLogin: new Date(),
        },
      },
    });
  }

  async login(req: Request, res: Response): Promise<void> {
    const { username, password }: LoginInput = req.body;
    const normalizedUsername = username.toLowerCase();
    const admin = await Admin.findOne({ $or: [{ username: normalizedUsername }, { email: normalizedUsername }] });
    if (!admin) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
      return;
    }
    if (admin.isLocked()) {
      const remainingMinutes = admin.lockUntil ? Math.ceil((admin.lockUntil.getTime() - Date.now()) / 60000) : 15;
      res.status(403).json({ success: false, error: { code: 'ACCOUNT_LOCKED', message: `Account is temporarily locked due to excessive failed attempts. Try again in ${remainingMinutes} minutes.` } });
      return;
    }
    if (!(await admin.comparePassword(password))) {
      await Admin.incrementLoginAttempts(admin._id.toString());
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
      return;
    }
    await Admin.resetLoginAttempts(admin._id.toString());
    if (admin.twoFactorEnabled) {
      if (!admin.emailVerified) {
        res.status(403).json({ success: false, error: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify the administrator email address before using two-factor sign-in.' } });
        return;
      }
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      admin.twoFactorCodeHash = hashCode(code);
      admin.twoFactorCodeExpiresAt = new Date(Date.now() + CODE_TTL_MS);
      await admin.save();
      await emailService.sendAdminCode(admin.email, 'login', code);
      const challengeToken = jwt.sign({ id: admin._id.toString(), purpose: 'admin-2fa' }, env.JWT_SECRET, { expiresIn: '10m' });
      res.json({ success: true, data: { twoFactorRequired: true, challengeToken } });
      return;
    }
    await this.completeLogin(admin, req, res);
  }

  async verifyTwoFactor(req: Request, res: Response): Promise<void> {
    const { challengeToken, code } = req.body as { challengeToken: string; code: string };
    let payload: { id: string; purpose: string };
    try {
      payload = jwt.verify(challengeToken, env.JWT_SECRET) as { id: string; purpose: string };
    } catch {
      res.status(401).json({ success: false, error: { code: 'CHALLENGE_EXPIRED', message: 'The sign-in code expired. Please sign in again.' } });
      return;
    }
    if (payload.purpose !== 'admin-2fa' || !payload.id) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CHALLENGE', message: 'Invalid two-factor sign-in challenge.' } });
      return;
    }
    const admin = await Admin.findById(payload.id).select('+twoFactorCodeHash +twoFactorCodeExpiresAt');
    if (!admin || !admin.twoFactorEnabled || !matchesCode(code, admin.twoFactorCodeHash, admin.twoFactorCodeExpiresAt)) {
      if (admin) await Admin.incrementLoginAttempts(admin._id.toString());
      res.status(401).json({ success: false, error: { code: 'INVALID_CODE', message: 'That code is incorrect or has expired.' } });
      return;
    }
    admin.twoFactorCodeHash = undefined;
    admin.twoFactorCodeExpiresAt = undefined;
    await admin.save();
    await Admin.resetLoginAttempts(admin._id.toString());
    await this.completeLogin(admin, req, res);
  }

  async logout(req: Request, res: Response): Promise<void> {
    const adminId = req.admin?.id;
    this.clearSessionCookie(res);
    if (adminId) {
      await Admin.findByIdAndUpdate(adminId, { $inc: { sessionVersion: 1 } });
      await auditService.log(adminId, 'auth.logout', 'admin', adminId, { username: req.admin?.username }, req.ip || 'unknown');
    }
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    const admin = await Admin.findById(req.admin?.id).select('-passwordHash');
    if (!admin) {
      res.status(404).json({ success: false, error: { code: 'ADMIN_NOT_FOUND', message: 'Admin account not found' } });
      return;
    }
    res.status(200).json({ success: true, data: admin });
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    const { currentPassword, newPassword }: ChangePasswordInput = req.body;
    const adminId = req.admin!.id;
    const admin = await Admin.findById(adminId);
    if (!admin) {
      res.status(404).json({ success: false, error: { code: 'ADMIN_NOT_FOUND', message: 'Admin account not found' } });
      return;
    }
    if (!(await admin.comparePassword(currentPassword))) {
      res.status(400).json({ success: false, error: { code: 'INVALID_CURRENT_PASSWORD', message: 'The current password you provided is incorrect' } });
      return;
    }
    admin.passwordHash = await bcrypt.hash(newPassword, 12);
    admin.sessionVersion += 1;
    await admin.save();
    this.clearSessionCookie(res);
    await auditService.log(adminId, 'auth.change_password', 'admin', adminId, {}, req.ip || 'unknown');
    res.status(200).json({ success: true, message: 'Password changed successfully. Sign in again with your new password.' });
  }

  async sendEmailVerification(req: Request, res: Response): Promise<void> {
    const admin = await Admin.findById(req.admin!.id).select('+emailVerificationCodeHash +emailVerificationExpiresAt');
    if (!admin) {
      res.status(404).json({ success: false, error: { code: 'ADMIN_NOT_FOUND', message: 'Admin account not found' } });
      return;
    }
    if (admin.emailVerified) {
      res.json({ success: true, message: 'Administrator email is already verified.' });
      return;
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    admin.emailVerificationCodeHash = hashCode(code);
    admin.emailVerificationExpiresAt = new Date(Date.now() + CODE_TTL_MS);
    await admin.save();
    await emailService.sendAdminCode(admin.email, 'email verification', code);
    res.json({ success: true, message: `A verification code was sent to ${admin.email}.` });
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    const admin = await Admin.findById(req.admin!.id).select('+emailVerificationCodeHash +emailVerificationExpiresAt');
    if (!admin || !matchesCode(req.body.code, admin.emailVerificationCodeHash, admin.emailVerificationExpiresAt)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'That verification code is incorrect or has expired.' } });
      return;
    }
    admin.emailVerified = true;
    admin.emailVerificationCodeHash = undefined;
    admin.emailVerificationExpiresAt = undefined;
    await admin.save();
    await auditService.log(admin._id.toString(), 'auth.email.verify', 'admin', admin._id.toString(), {}, req.ip || 'unknown');
    res.json({ success: true, data: { emailVerified: true } });
  }

  async requestEmailChange(req: Request, res: Response): Promise<void> {
    const { currentPassword, email } = req.body as { currentPassword: string; email: string };
    const admin = await Admin.findById(req.admin!.id).select('+emailChangeCodeHash +emailChangeCodeExpiresAt +pendingEmail');
    if (!admin) {
      res.status(404).json({ success: false, error: { code: 'ADMIN_NOT_FOUND', message: 'Admin account not found' } });
      return;
    }
    if (!(await admin.comparePassword(currentPassword))) {
      res.status(400).json({ success: false, error: { code: 'INVALID_CURRENT_PASSWORD', message: 'The current password you provided is incorrect' } });
      return;
    }
    if (email === admin.email) {
      res.status(400).json({ success: false, error: { code: 'EMAIL_UNCHANGED', message: 'Enter a different email address.' } });
      return;
    }
    if (await Admin.exists({ email })) {
      res.status(409).json({ success: false, error: { code: 'EMAIL_IN_USE', message: 'That email address is already assigned to an administrator.' } });
      return;
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    admin.pendingEmail = email;
    admin.emailChangeCodeHash = hashCode(code);
    admin.emailChangeCodeExpiresAt = new Date(Date.now() + CODE_TTL_MS);
    await admin.save();
    await emailService.sendAdminCode(email, 'email change', code);
    res.json({ success: true, message: `A confirmation code was sent to ${email}.` });
  }

  async confirmEmailChange(req: Request, res: Response): Promise<void> {
    const admin = await Admin.findById(req.admin!.id).select('+pendingEmail +emailChangeCodeHash +emailChangeCodeExpiresAt');
    if (!admin || !admin.pendingEmail || !matchesCode(req.body.code, admin.emailChangeCodeHash, admin.emailChangeCodeExpiresAt)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'That confirmation code is incorrect or has expired.' } });
      return;
    }
    if (await Admin.exists({ email: admin.pendingEmail, _id: { $ne: admin._id } })) {
      res.status(409).json({ success: false, error: { code: 'EMAIL_IN_USE', message: 'That email address is already assigned to an administrator.' } });
      return;
    }
    admin.email = admin.pendingEmail;
    admin.pendingEmail = undefined;
    admin.emailVerified = true;
    admin.emailChangeCodeHash = undefined;
    admin.emailChangeCodeExpiresAt = undefined;
    await admin.save();
    await auditService.log(admin._id.toString(), 'auth.email.change', 'admin', admin._id.toString(), {}, req.ip || 'unknown');
    res.json({ success: true, data: { email: admin.email, emailVerified: true } });
  }

  async setupTwoFactor(req: Request, res: Response): Promise<void> {
    const admin = await Admin.findById(req.admin!.id).select('+twoFactorCodeHash +twoFactorCodeExpiresAt');
    if (!admin) {
      res.status(404).json({ success: false, error: { code: 'ADMIN_NOT_FOUND', message: 'Admin account not found' } });
      return;
    }
    if (!admin.emailVerified) {
      res.status(400).json({ success: false, error: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email before enabling two-factor authentication.' } });
      return;
    }
    if (admin.twoFactorEnabled) {
      res.status(409).json({ success: false, error: { code: 'TWO_FACTOR_ENABLED', message: 'Email two-factor authentication is already enabled.' } });
      return;
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    admin.twoFactorCodeHash = hashCode(code);
    admin.twoFactorCodeExpiresAt = new Date(Date.now() + CODE_TTL_MS);
    await admin.save();
    await emailService.sendAdminCode(admin.email, 'two-factor setup', code);
    res.json({ success: true, message: `A setup code was sent to ${admin.email}.` });
  }

  async enableTwoFactor(req: Request, res: Response): Promise<void> {
    const admin = await Admin.findById(req.admin!.id).select('+twoFactorCodeHash +twoFactorCodeExpiresAt');
    if (!admin || !admin.emailVerified || !matchesCode(req.body.code, admin.twoFactorCodeHash, admin.twoFactorCodeExpiresAt)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'That setup code is incorrect or has expired.' } });
      return;
    }
    admin.twoFactorEnabled = true;
    admin.twoFactorCodeHash = undefined;
    admin.twoFactorCodeExpiresAt = undefined;
    await admin.save();
    await auditService.log(admin._id.toString(), 'auth.two_factor.enable', 'admin', admin._id.toString(), { method: 'email' }, req.ip || 'unknown');
    res.json({ success: true, data: { twoFactorEnabled: true } });
  }

  async disableTwoFactor(req: Request, res: Response): Promise<void> {
    const admin = await Admin.findById(req.admin!.id).select('+twoFactorCodeHash +twoFactorCodeExpiresAt');
    if (!admin || !(await admin.comparePassword(req.body.currentPassword))) {
      res.status(400).json({ success: false, error: { code: 'INVALID_CURRENT_PASSWORD', message: 'The current password you provided is incorrect.' } });
      return;
    }
    admin.twoFactorEnabled = false;
    admin.twoFactorCodeHash = undefined;
    admin.twoFactorCodeExpiresAt = undefined;
    await admin.save();
    await auditService.log(admin._id.toString(), 'auth.two_factor.disable', 'admin', admin._id.toString(), { method: 'email' }, req.ip || 'unknown');
    res.json({ success: true, data: { twoFactorEnabled: false } });
  }
}

export const authController = new AuthController();
