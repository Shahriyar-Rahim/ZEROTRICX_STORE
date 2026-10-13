import nodemailer, { Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

type AdminCodePurpose = 'login' | 'email verification' | 'email change' | 'two-factor setup';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export class EmailService {
  private transporter: Transporter | null = null;
  private resend: Resend | null = null;
  private readonly sender = env.EMAIL_FROM || env.SMTP_FROM || env.SMTP_USER;

  constructor() {
    if (env.RESEND_API_KEY) {
      this.resend = new Resend(env.RESEND_API_KEY);
    } else if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    }
  }

  async sendAdminNotification(subject: string, html: string): Promise<void> {
    if (!env.ADMIN_EMAIL) {
      throw new AppError('Set ADMIN_EMAIL to receive administrator notifications.', 503, 'EMAIL_NOT_CONFIGURED');
    }
    await this.sendMessage({
      to: env.ADMIN_EMAIL,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
  }

  private async sendMessage(message: { to: string; subject: string; text: string; html: string }): Promise<void> {
    const resend = this.resend;
    const transporter = this.transporter;
    if (!this.sender) {
      throw new AppError(
        'Set EMAIL_FROM to an address verified with your email provider.',
        503,
        'EMAIL_NOT_CONFIGURED',
      );
    }
    if (!resend && !transporter) {
      throw new AppError(
        'Configure RESEND_API_KEY or SMTP_HOST, SMTP_USER, and SMTP_PASS to enable email delivery.',
        503,
        'EMAIL_NOT_CONFIGURED',
      );
    }

    try {
      if (resend) {
        const { error } = await resend.emails.send({
          from: this.sender,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        if (error) {
          throw Object.assign(new Error('Resend rejected the email request.'), {
            code: error.name,
            responseCode: Number(error.statusCode),
          });
        }
        return;
      }

      if (!transporter) {
        throw new Error('SMTP transport is unavailable.');
      }
      await transporter.sendMail({
        from: this.sender,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (error) {
      const deliveryError = error as Error & { code?: string; responseCode?: number };
      const errorCode = deliveryError.code || deliveryError.name || 'Error';
      const responseCode = deliveryError.responseCode;
      console.error(`[Email] Delivery failed via ${resend ? 'Resend' : 'SMTP'}: ${errorCode} (response ${responseCode || 'unavailable'})`);

      const rejectedByServer = resend
        ? responseCode !== undefined
          && responseCode >= 400
          && responseCode < 500
          && ![408, 425, 429].includes(responseCode)
        : deliveryError.code === 'EMESSAGE'
          || (responseCode !== undefined && responseCode >= 500);
      throw new AppError(
        rejectedByServer
          ? 'The email provider rejected the message. Verify the sender address and provider configuration.'
          : 'The email could not be sent because the provider is unavailable or its configuration is invalid.',
        rejectedByServer ? 502 : 503,
        rejectedByServer ? 'EMAIL_DELIVERY_FAILED' : 'EMAIL_TRANSPORT_UNAVAILABLE',
      );
    }
  }

  async sendAdminCode(email: string, purpose: AdminCodePurpose, code: string): Promise<void> {
    const safePurpose = escapeHtml(purpose);
    const safeCode = escapeHtml(code);
    const text = `Your ${purpose} code is ${code}. It expires in 10 minutes. Never share this code. If you did not request it, you can ignore this email.`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#14251c;line-height:1.6">
        <h2 style="margin:0 0 20px">ZEROTRICX STORE</h2>
        <p>Use this code to complete your admin ${safePurpose}:</p>
        <p style="margin:24px 0;padding:18px;background:#f3f6f3;border-radius:8px;text-align:center">
          <strong style="font-size:30px;letter-spacing:8px">${safeCode}</strong>
        </p>
        <p>This code expires in 10 minutes. Never share it with anyone.</p>
        <p style="color:#58645d">If you did not request this code, you can ignore this email.</p>
      </div>`;
    await this.sendMessage({
      to: email,
      subject: `ZEROTRICX STORE admin ${purpose} code`,
      text,
      html,
    });
  }
}

export const emailService = new EmailService();
