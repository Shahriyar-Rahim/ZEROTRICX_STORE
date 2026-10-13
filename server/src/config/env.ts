import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  SERVER_URL: z.string().url().default('http://localhost:5000'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/software-store'),

  JWT_SECRET: z.string().min(32).default('development-only-jwt-secret-change-before-production-123456'),
  COOKIE_DOMAIN: z.string().optional(),

  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET_NAME: z.string().default(''),
  R2_STAGING_BUCKET_NAME: z.string().default(''),
  R2_PUBLIC_BASE_URL: z.string().url().default('https://downloads.example.com'),
  R2_ENDPOINT: z.string().url().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),

  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(2048),
  MAX_ICON_SIZE_MB: z.coerce.number().positive().default(5),
  MAX_SCREENSHOT_SIZE_MB: z.coerce.number().positive().default(10),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().email().optional(),
  ),
  RESEND_API_KEY: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().optional(),
  ),
  EMAIL_FROM: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().email().optional(),
  ),
  ADMIN_EMAIL: z.string().email().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().default(5),

  ANALYTICS_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration:', parsedEnv.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env = parsedEnv.data;
if (env.NODE_ENV === 'production') {
  const required = [
    'CLIENT_URL', 'SERVER_URL', 'MONGODB_URI', 'JWT_SECRET',
    'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_STAGING_BUCKET_NAME',
    'R2_PUBLIC_BASE_URL', 'R2_ENDPOINT', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  ];
  const missing = required.filter((key) => {
    const value = process.env[key]?.trim();
    return !value || /development-only|change-me|your-|example\.com/i.test(value);
  });
  if (missing.length) {
    throw new Error(`Production environment requires secure values for: ${missing.join(', ')}`);
  }
  if (![env.CLIENT_URL, env.SERVER_URL, env.R2_ENDPOINT, env.R2_PUBLIC_BASE_URL].every((value) => value?.startsWith('https://'))) {
    throw new Error('Production client, server, R2 endpoint, and public download URLs must use HTTPS.');
  }
  if (env.R2_STAGING_BUCKET_NAME === env.R2_BUCKET_NAME) {
    throw new Error('R2_STAGING_BUCKET_NAME must be a separate private bucket from R2_BUCKET_NAME.');
  }
}
export type Env = z.infer<typeof envSchema>;
