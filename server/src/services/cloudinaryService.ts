import { randomUUID } from 'node:crypto';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { env } from '../config/env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export class CloudinaryService {
  isConfigured(): boolean {
    return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  }

  uploadImage(buffer: Buffer, appId: string, originalName: string): Promise<UploadApiResponse> {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary image storage is not configured on the server.');
    }
    const fileBase = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60) || 'image';
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        folder: `software-store/apps/${appId}`,
        public_id: `${fileBase}-${randomUUID()}`,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      }, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result) {
          reject(new Error('Cloudinary completed the image upload without returning an asset.'));
          return;
        }
        resolve(result);
      });
      stream.end(buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary image storage is not configured on the server.');
    }
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Cloudinary did not delete image asset "${publicId}".`);
    }
  }
}

export const cloudinaryService = new CloudinaryService();
