import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { resendSend, smtpSend, createTransport } = vi.hoisted(() => ({
  resendSend: vi.fn(),
  smtpSend: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

vi.mock('nodemailer', () => ({
  default: { createTransport },
}));

describe('email service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('EMAIL_FROM', 'no-reply@no-idea.top');
    vi.stubEnv('SMTP_HOST', '');
    vi.stubEnv('SMTP_PORT', '');
    vi.stubEnv('SMTP_SECURE', '');
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASS', '');
    vi.stubEnv('SMTP_FROM', '');
    resendSend.mockReset();
    smtpSend.mockReset();
    createTransport.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('sends admin codes through Resend with text and HTML content', async () => {
    resendSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });
    const { emailService } = await import('./emailService.js');

    await emailService.sendAdminCode('owner@example.com', 'login', '123456');

    expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({
      from: 'no-reply@no-idea.top',
      to: 'owner@example.com',
      subject: 'ZEROTRICX STORE admin login code',
      text: expect.stringContaining('123456'),
      html: expect.stringContaining('123456'),
    }));
  });

  it('reports provider rejection rather than returning success', async () => {
    resendSend.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', statusCode: 422 },
    });
    const { emailService } = await import('./emailService.js');

    await expect(emailService.sendAdminCode('owner@example.com', 'login', '123456'))
      .rejects.toMatchObject({ code: 'EMAIL_DELIVERY_FAILED', statusCode: 502 });
  });

  it('uses SMTP when no Resend API key is configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('SMTP_USER', 'smtp-user');
    vi.stubEnv('SMTP_PASS', 'smtp-password');
    smtpSend.mockResolvedValue({});
    createTransport.mockReturnValue({ sendMail: smtpSend });
    vi.resetModules();
    const { emailService } = await import('./emailService.js');

    await emailService.sendAdminCode('owner@example.com', 'email verification', '654321');

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
    }));
    expect(smtpSend).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@example.com',
      text: expect.stringContaining('654321'),
    }));
  });
});
