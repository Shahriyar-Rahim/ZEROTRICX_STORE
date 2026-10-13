import { z } from 'zod';

export const createReviewSchema = z.object({
  reviewerName: z.string().trim().min(2).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(10).max(2000),
});

export const moderateReviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});
