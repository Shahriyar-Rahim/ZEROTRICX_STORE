import { z } from 'zod';
import { externalUrlSchema } from './download.js';

const platformSchema = z.object({
  os: z.enum(['windows', 'linux', 'macos']),
  architectures: z.array(z.enum(['x64', 'arm64'])).min(1),
  minRequirements: z.string().optional(),
});

const screenshotSchema = z.object({
  key: z.string().min(1),
  url: externalUrlSchema,
  caption: z.string().optional().default(''),
  order: z.number().default(0),
});

export const createApplicationSchema = z.object({
  name: z.string().min(1, 'Application name is required').max(100).trim(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  shortDescription: z.string().min(1, 'Short description is required').max(200).trim(),
  description: z.string().min(1, 'Full description is required'),
  icon: z
    .object({
      key: z.string(),
      url: externalUrlSchema,
      mimeType: z.string().optional(),
    })
    .optional(),
  screenshots: z.array(screenshotSchema).optional().default([]),
  category: z.string().min(1, 'Category is required').trim(),
  features: z.array(z.string().trim()).optional().default([]),
  supportedPlatforms: z.array(platformSchema).min(1, 'At least one supported platform is required'),
  license: z.string().optional(),
  supportUrl: z.string().url().optional().or(z.literal('')),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  githubUrl: z.string().url().optional().or(z.literal('')),
  privacyPolicyUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  isFeatured: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  seoTitle: z.string().max(100).optional(),
  seoDescription: z.string().max(250).optional(),
  seoKeywords: z.array(z.string().trim()).optional().default([]),
  installationInstructions: z
    .object({
      windows: z.string().optional(),
      linux: z.string().optional(),
      macos: z.string().optional(),
    })
    .optional()
    .default({}),
  currentVersion: z.string().optional(),
});

export const updateApplicationSchema = createApplicationSchema.partial();

export const applicationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(12),
  search: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
  category: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
  os: z.preprocess((value) => value === '' ? undefined : value, z.enum(['windows', 'linux', 'macos']).optional()),
  isFeatured: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  isPinned: z.string().transform((val) => val === 'true').optional(),
  sort: z.enum(['downloads', 'newest', 'name', 'updated']).default('downloads'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type ApplicationQueryParams = z.infer<typeof applicationQuerySchema>;
