import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

export class EmailService {
  private transporter: Transporter | null = null;
  private readonly sender = env.SMTP_FROM || env.SMTP_USER || env.ADMIN_EMAIL;

  constructor() {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_SECURE || false,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    }
  }

  async sendAdminNotification(subject: string, html: string): Promise<void> {
    if (!this.transporter || !this.sender || !env.ADMIN_EMAIL) {
      throw new Error('Email notifications are not configured.');
    }

    await this.transporter.sendMail({
      from: this.sender,
      to: env.ADMIN_EMAIL,
      subject,
      html,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${env.CLIENT_URL}/admin/reset-password?token=${encodeURIComponent(resetToken)}`;
    const html = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2>Password Reset Request</h2>
        <p>You have requested a password reset for your ZEROTRICX Software administrator account.</p>
        <p>Click the link below to set a new password. This link is valid for 1 hour.</p>
        <p style="margin: 20px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `;

    if (!this.transporter) {
      throw new Error('Password reset email delivery is not configured.');
    }

    await this.transporter.sendMail({
      from: this.sender,
      to: email,
      subject: 'ZEROTRICX Software - Password Reset Request',
      html,
    });
  }

  async sendAdminCode(email: string, purpose: 'login' | 'email verification' | 'email change' | 'two-factor setup', code: string): Promise<void> {
    if (!this.transporter || !this.sender) {
      throw new AppError(
        'Admin email delivery is not configured. Configure SMTP_HOST, SMTP_USER, SMTP_PASS, and a verified SMTP_FROM address.',
        503,
        'EMAIL_NOT_CONFIGURED',
      );
    }
    try {
      await this.transporter.sendMail({
        from: this.sender,
        to: email,
        subject: `ZEROTRICX Software admin ${purpose} code`,
        text: `Your ${purpose} code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
        html: `<p>Your ${purpose} code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not request this code, you can ignore this email.</p>`,
      });
    } catch (error) {
      const smtpError = error as Error & { code?: string; responseCode?: number };
      console.error(`[Email] Admin code delivery failed: ${smtpError.code || smtpError.name || 'Error'} (${smtpError.responseCode || 'no SMTP response code'})`);
      const rejectedByServer = smtpError.code === 'EMESSAGE' || Boolean(smtpError.responseCode);
      throw new AppError(
        rejectedByServer
          ? 'The SMTP server rejected the verification email. Check that SMTP_FROM is an address verified with your email provider and that the recipient address can receive mail.'
          : 'The verification email could not be sent because the SMTP service could not be reached. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, and SMTP credentials.',
        rejectedByServer ? 502 : 503,
        rejectedByServer ? 'EMAIL_DELIVERY_FAILED' : 'EMAIL_TRANSPORT_UNAVAILABLE',
      );
    }
  }
}

export const emailService = new EmailService();
