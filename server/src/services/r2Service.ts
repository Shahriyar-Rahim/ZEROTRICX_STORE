import { Readable } from 'stream';
import {
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client } from '../config/r2.js';
import { env } from '../config/env.js';

export class R2Service {
  private bucket: string;
  readonly stagingBucket: string;

  constructor() {
    this.bucket = env.R2_BUCKET_NAME;
    this.stagingBucket = env.R2_STAGING_BUCKET_NAME;
  }

  /**
   * Generate a safe, sanitized object key from validated inputs
   */
  generateObjectKey(appSlug: string, version: string, os: string, arch: string, filename: string): string {
    const cleanAppSlug = appSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanVersion = version.replace(/[^a-zA-Z0-9._-]/g, '');
    const cleanOs = os.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanArch = arch.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    return `apps/${cleanAppSlug}/${cleanVersion}/${cleanOs}-${cleanArch}/${cleanFilename}`;
  }

  /**
   * Create a presigned upload URL (for direct browser upload)
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    maxSizeBytes?: number,
    bucket = this.bucket
  ): Promise<{ url: string; key: string }> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ...(maxSizeBytes ? { ContentLength: maxSizeBytes } : {}),
    });

    const url = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    return { url, key };
  }

  /**
   * Upload a file from server (for server-side upload)
   */
  async uploadFile(
    key: string,
    body: Buffer | Readable,
    contentType: string,
    metadata?: Record<string, string>,
    bucket = this.bucket
  ): Promise<{ key: string; etag: string }> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    });

    const response = await r2Client.send(command);
    return {
      key,
      etag: (response.ETag || '').replace(/"/g, ''),
    };
  }

  /**
   * Initiate multipart upload
   */
  async initiateMultipartUpload(
    key: string,
    contentType: string,
    metadata?: Record<string, string>,
    bucket = this.bucket
  ): Promise<{ uploadId: string; key: string }> {
    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
    });

    const response = await r2Client.send(command);
    if (!response.UploadId) {
      throw new Error('Failed to initiate multipart upload in R2');
    }

    return {
      uploadId: response.UploadId,
      key,
    };
  }

  /**
   * Get presigned URL for a multipart upload part
   */
  async getPresignedPartUrl(key: string, uploadId: string, partNumber: number, contentLength: number, bucket = this.bucket): Promise<string> {
    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      ContentLength: contentLength,
    });

    return getSignedUrl(r2Client, command, { expiresIn: 3600 });
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { PartNumber: number; ETag: string }[],
    bucket = this.bucket
  ): Promise<void> {
    // Sort parts by PartNumber ascending as required by S3 specification
    const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts.map((p) => ({
          PartNumber: p.PartNumber,
          ETag: p.ETag.includes('"') ? p.ETag : `"${p.ETag}"`,
        })),
      },
    });

    await r2Client.send(command);
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(key: string, uploadId: string, bucket = this.bucket): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    });

    await r2Client.send(command);
  }

  /**
   * Delete an object
   */
  async deleteObject(key: string, bucket = this.bucket): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await r2Client.send(command);
  }

  /**
   * Check if object exists
   */
  async objectExists(key: string, bucket = this.bucket): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      await r2Client.send(command);
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Get object metadata (size, etc.)
   */
  async getObjectMetadata(
    key: string,
    bucket = this.bucket
  ): Promise<{ contentLength: number; contentType: string; etag: string } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await r2Client.send(command);
      return {
        contentLength: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        etag: (response.ETag || '').replace(/"/g, ''),
      };
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async getObjectStream(key: string, bucket = this.bucket): Promise<Readable> {
    const response = await r2Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    if (!response.Body) {
      throw new Error('R2 returned an empty object body');
    }
    return response.Body as Readable;
  }

  async moveObject(
    key: string,
    sourceBucket: string,
    targetBucket: string,
    contentType: string,
    cacheControl: string
  ): Promise<void> {
    if (sourceBucket === targetBucket) return;
    const copySource = encodeURIComponent(`${sourceBucket}/${key}`).replace(/%2F/g, '/');
    await r2Client.send(new CopyObjectCommand({
      Bucket: targetBucket,
      Key: key,
      CopySource: copySource,
      MetadataDirective: 'REPLACE',
      ContentType: contentType,
      CacheControl: cacheControl,
    }));
  }

  /**
   * Get the public URL for a key
   */
  getPublicUrl(key: string): string {
    const base = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '');
    const cleanKey = key.replace(/^\/+/, '');
    return `${base}/${cleanKey}`;
  }

  /**
   * List objects with prefix
   */
  async listObjects(prefix: string, bucket = this.bucket): Promise<{ key: string; size: number; lastModified: Date }[]> {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });

    const response = await r2Client.send(command);
    if (!response.Contents) {
      return [];
    }

    return response.Contents.map((item) => ({
      key: item.Key || '',
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
    }));
  }
}

export const r2Service = new R2Service();
