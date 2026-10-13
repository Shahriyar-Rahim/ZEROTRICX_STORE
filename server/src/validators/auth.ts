import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'New password must contain at least one number'),
});

export const verifyTwoFactorSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit email code'),
});

export const currentPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
});

export const emailCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit email code'),
});

export const emailChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
