import { z } from 'zod';
import { externalUrlSchema } from './download.js';

export const updateSettingsSchema = z.object({
  storeName: z.string().min(1, 'Store name cannot be empty').max(100).optional(),
  storeDescription: z.string().max(500).optional(),
  logo: z
    .object({
      key: z.string(),
      url: externalUrlSchema,
    })
    .optional(),
  favicon: z
    .object({
      key: z.string(),
      url: externalUrlSchema,
    })
    .optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  supportUrl: externalUrlSchema.optional().or(z.literal('')),
  socialLinks: z
    .object({
      github: externalUrlSchema.or(z.literal('')).optional().default(''),
      twitter: externalUrlSchema.or(z.literal('')).optional().default(''),
      discord: externalUrlSchema.or(z.literal('')).optional().default(''),
      youtube: externalUrlSchema.or(z.literal('')).optional().default(''),
    })
    .optional(),
  seoDefaults: z
    .object({
      title: z.string().optional().default('ZEROTRICX Software'),
      description: z.string().optional().default('Download official software releases.'),
      keywords: z.array(z.string().trim()).optional().default([]),
    })
    .optional(),
  downloadDomain: z.string().optional(),
  analyticsEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  footerText: z.string().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
