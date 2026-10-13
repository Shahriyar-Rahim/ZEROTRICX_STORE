import { env } from '../config/env.js';
import type { IDownloadDocument } from '../models/Download.js';
import { r2Service } from './r2Service.js';

const PUBLIC_CACHE_CONTROL = 'public, max-age=60';
const PRIVATE_CACHE_CONTROL = 'private, no-store';

export class DownloadStorageService {
  async publish(download: IDownloadDocument): Promise<void> {
    if (download.storageProvider !== 'r2' || !download.r2Key) return;
    const sourceBucket = download.r2Bucket || r2Service.stagingBucket;
    const targetBucket = env.R2_BUCKET_NAME;
    if (!targetBucket || !r2Service.stagingBucket || targetBucket === r2Service.stagingBucket) {
      throw new Error('Public and staging R2 buckets must be configured before publishing installers.');
    }
    const source = await r2Service.getObjectMetadata(download.r2Key, sourceBucket);
    if (!source || source.contentLength !== download.fileSize) {
      throw new Error('The installer object does not exist in its recorded R2 bucket.');
    }
    if (sourceBucket !== targetBucket) {
      await r2Service.moveObject(download.r2Key, sourceBucket, targetBucket, download.mimeType || 'application/octet-stream', PUBLIC_CACHE_CONTROL);
      const copied = await r2Service.getObjectMetadata(download.r2Key, targetBucket);
      if (!copied || copied.contentLength !== download.fileSize) {
        await r2Service.deleteObject(download.r2Key, targetBucket);
        throw new Error('R2 could not verify the public copy of this installer.');
      }
      await r2Service.deleteObject(download.r2Key, sourceBucket);
      download.r2Bucket = targetBucket;
    }
  }

  async unpublish(download: IDownloadDocument): Promise<void> {
    if (download.storageProvider !== 'r2' || !download.r2Key) return;
    const publicBucket = env.R2_BUCKET_NAME;
    const privateBucket = r2Service.stagingBucket;
    const sourceBucket = download.r2Bucket || publicBucket;
    if (sourceBucket !== publicBucket) return;
    if (!privateBucket || publicBucket === privateBucket) {
      throw new Error('A separate private R2 staging bucket is required before disabling published installers.');
    }
    if (await r2Service.objectExists(download.r2Key, publicBucket)) {
      await r2Service.moveObject(download.r2Key, publicBucket, privateBucket, download.mimeType || 'application/octet-stream', PRIVATE_CACHE_CONTROL);
      const copied = await r2Service.getObjectMetadata(download.r2Key, privateBucket);
      if (!copied || copied.contentLength !== download.fileSize) {
        await r2Service.deleteObject(download.r2Key, privateBucket);
        throw new Error('R2 could not verify the private copy of this installer.');
      }
      await r2Service.deleteObject(download.r2Key, publicBucket);
    }
    download.r2Bucket = privateBucket;
  }
}

export const downloadStorageService = new DownloadStorageService();
