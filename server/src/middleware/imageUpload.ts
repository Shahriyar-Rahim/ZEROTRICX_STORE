import multer from 'multer';

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (!acceptedMimeTypes.has(file.mimetype)) {
      const error = new Error('Upload a JPEG, PNG, WebP, or AVIF image.') as Error & { statusCode: number; code: string };
      error.statusCode = 415;
      error.code = 'UNSUPPORTED_IMAGE_TYPE';
      callback(error);
      return;
    }
    callback(null, true);
  },
});
