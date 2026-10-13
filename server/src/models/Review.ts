import mongoose, { Document, Schema } from 'mongoose';

export interface IReview {
  application: mongoose.Types.ObjectId;
  reviewerName: string;
  rating: number;
  text: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface IReviewDocument extends IReview, Document {}

const ReviewSchema = new Schema<IReviewDocument>({
  application: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
  reviewerName: { type: String, required: true, trim: true, maxlength: 80 },
  rating: { type: Number, required: true, min: 1, max: 5 },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
}, { timestamps: true });

ReviewSchema.index({ application: 1, status: 1, createdAt: -1 });

export const Review = mongoose.model<IReviewDocument>('Review', ReviewSchema);
