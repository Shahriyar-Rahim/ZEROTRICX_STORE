import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { env } from '../config/env.js';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

function storageErrorDetails(err: any): { statusCode: number; code: string; message: string } | undefined {
  const serviceCode = String(err.Code || err.code || err.name || '');
  if (/^(AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch|InvalidToken|AuthorizationHeaderMalformed)$/.test(serviceCode)) {
    return {
      statusCode: 502,
      code: 'R2_ACCESS_DENIED',
      message: 'Cloudflare R2 rejected the request. Verify the access key and secret belong together, the account ID matches R2_ENDPOINT, and the API token has Object Read & Write access to both configured buckets.',
    };
  }
  if (serviceCode === 'NoSuchBucket' || serviceCode === 'NotFound') {
    return {
      statusCode: 502,
      code: 'R2_BUCKET_NOT_FOUND',
      message: 'Cloudflare R2 could not find the configured bucket. Verify R2_BUCKET_NAME and R2_STAGING_BUCKET_NAME exactly match the bucket names.',
    };
  }
  if (/^(NetworkingError|TimeoutError|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT)$/.test(serviceCode)) {
    return {
      statusCode: 503,
      code: 'R2_UNAVAILABLE',
      message: 'The API could not connect to Cloudflare R2. Check the network and R2_ENDPOINT.',
    };
  }
  return undefined;
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Resource not found: ${req.method} ${req.path}`,
    },
  });
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Safe logging: remove passwords / tokens
  const safeReq = {
    method: req.method,
    path: req.path,
  };
  const serviceCode = String(err.Code || err.code || err.name || 'no code');
  const providerStatus = err.$metadata?.httpStatusCode;
  const requestId = err.$metadata?.requestId;
  console.error(
    `[Error] ${safeReq.method} ${safeReq.path}: ${err.name || 'Error'} (${serviceCode}; upstream ${providerStatus || 'no status'}; request ${requestId || 'no id'})`,
  );

  // Default values
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err instanceof AppError
    ? err.message
    : err.statusCode && err.statusCode < 500
      ? err.message
      : 'An unexpected internal error occurred';
  let details = err.details || undefined;
  const storageError = storageErrorDetails(err);

  if (storageError) {
    statusCode = storageError.statusCode;
    code = storageError.code;
    message = storageError.message;
  }

  // 1. Zod Validation Errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  // 2. Mongoose Validation Errors
  else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    code = 'DATABASE_VALIDATION_ERROR';
    message = 'Validation failed for database entity';
    details = Object.keys(err.errors).map((key) => ({
      field: key,
      message: err.errors[key].message,
    }));
  }

  // 3. Mongoose Cast Error (Invalid ObjectId)
  else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Invalid format for field: ${err.path}`;
  }

  // 4. Mongoose Duplicate Key Error (E11000)
  else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY_ERROR';
    const fields = Object.keys(err.keyPattern || {});
    message = `Duplicate record found for unique field(s): ${fields.join(', ')}`;
    details = fields;
  }

  // 5. JWT Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Malformed or invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  }

  // 6. Multer Errors (if file uploads)
  else if (err.name === 'MulterError') {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = 'FILE_UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'The selected image is too large. Choose a smaller file and try again.'
      : err.message;
  }

  // Response payload
  const errorPayload: Record<string, any> = {
    code,
    message,
  };

  if (details) {
    errorPayload.details = details;
  }

  if (env.NODE_ENV === 'development' && err.stack && statusCode < 500) {
    errorPayload.stack = err.stack;
  }

  res.status(statusCode).json({
    success: false,
    error: errorPayload,
  });
}
