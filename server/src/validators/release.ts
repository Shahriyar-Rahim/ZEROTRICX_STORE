import { z } from 'zod';

export const createReleaseSchema = z.object({
  version: z
    .string()
    .min(1, 'Version is required')
    .regex(/^v?([0-9]+)\.([0-9]+)\.([0-9]+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, 'Must be a valid semantic version (e.g., 1.0.0 or v1.0.0)')
    .trim(),
  releaseDate: z.coerce.date().default(() => new Date()),
  changelog: z.string().optional().default(''),
  releaseType: z.enum(['stable', 'beta', 'alpha']).default('stable'),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  minimumRequirements: z
    .object({
      windows: z.string().optional().default(''),
      linux: z.string().optional().default(''),
      macos: z.string().optional().default(''),
    })
    .optional()
    .default({}),
  knownIssues: z.array(z.string().trim()).optional().default([]),
});

export const updateReleaseSchema = createReleaseSchema.partial();

export type CreateReleaseInput = z.infer<typeof createReleaseSchema>;
export type UpdateReleaseInput = z.infer<typeof updateReleaseSchema>;
