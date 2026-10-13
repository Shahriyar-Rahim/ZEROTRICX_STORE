import { Request, Response } from 'express';
import { Application } from '../models/Application.js';
import { Review } from '../models/Review.js';
import { auditService } from '../services/auditService.js';

export class ReviewController {
  async publicList(req: Request, res: Response): Promise<void> {
    const app = await Application.findOne({ slug: req.params.slug, status: 'published' }).select('_id');
    if (!app) {
      res.status(404).json({ success: false, error: { code: 'APP_NOT_FOUND', message: 'Application not found.' } });
      return;
    }
    const [reviews, summary] = await Promise.all([
      Review.find({ application: app._id, status: 'approved' }).sort({ createdAt: -1 }).limit(100).select('reviewerName rating text createdAt').lean(),
      Review.aggregate([
        { $match: { application: app._id, status: 'approved' } },
        { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
    ]);
    res.json({ success: true, data: { reviews, average: summary[0]?.average ?? null, count: summary[0]?.count ?? 0 } });
  }

  async create(req: Request, res: Response): Promise<void> {
    const app = await Application.findOne({ slug: req.params.slug, status: 'published' }).select('_id');
    if (!app) {
      res.status(404).json({ success: false, error: { code: 'APP_NOT_FOUND', message: 'Application not found.' } });
      return;
    }
    await Review.create({ ...req.body, application: app._id, status: 'pending' });
    res.status(201).json({ success: true, message: 'Thanks for your review. It will appear after moderation.' });
  }

  async adminList(req: Request, res: Response): Promise<void> {
    const status = ['pending', 'approved', 'rejected'].includes(String(req.query.status)) ? String(req.query.status) : undefined;
    const reviews = await Review.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(200)
      .populate('application', 'name slug').lean();
    res.json({ success: true, data: reviews });
  }

  async moderate(req: Request, res: Response): Promise<void> {
    const review = await Review.findByIdAndUpdate(req.params.reviewId, { status: req.body.status }, { new: true });
    if (!review) {
      res.status(404).json({ success: false, error: { code: 'REVIEW_NOT_FOUND', message: 'Review not found.' } });
      return;
    }
    await auditService.log(req.admin!.id, `review.${req.body.status}`, 'review', review._id.toString(), {}, req.ip || 'unknown');
    res.json({ success: true, data: review });
  }

  async delete(req: Request, res: Response): Promise<void> {
    const review = await Review.findByIdAndDelete(req.params.reviewId);
    if (!review) {
      res.status(404).json({ success: false, error: { code: 'REVIEW_NOT_FOUND', message: 'Review not found.' } });
      return;
    }
    await auditService.log(req.admin!.id, 'review.delete', 'review', review._id.toString(), {}, req.ip || 'unknown');
    res.json({ success: true, message: 'Review deleted.' });
  }
}

export const reviewController = new ReviewController();
