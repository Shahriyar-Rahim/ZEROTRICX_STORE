import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { Application } from '../models/Application.js';
import { Download } from '../models/Download.js';
import { DownloadEvent } from '../models/DownloadEvent.js';
import { Release } from '../models/Release.js';
import { env } from '../config/env.js';
import { r2Service } from '../services/r2Service.js';
import { checksumService } from '../services/checksumService.js';
import { auditService } from '../services/auditService.js';
import { downloadStorageService } from '../services/downloadStorageService.js';
import { isSafePublicUrl } from '../validators/download.js';

const extensions: Record<string, string[]> = {
  exe: ['.exe'], msi: ['.msi'], zip: ['.zip'], deb: ['.deb'],
  appimage: ['.appimage'], rpm: ['.rpm'], dmg: ['.dmg'], pkg: ['.pkg'],
  'tar.gz': ['.tar.gz'],
};
const contentTypes: Record<string, string> = {
  exe: 'application/vnd.microsoft.portable-executable',
  msi: 'application/x-msi',
  zip: 'application/zip',
  deb: 'application/vnd.debian.binary-package',
  appimage: 'application/octet-stream',
  rpm: 'application/x-rpm',
  dmg: 'application/x-apple-diskimage',
  pkg: 'application/octet-stream',
  'tar.gz': 'application/gzip',
};

function validFileName(name: string, format: string): boolean {
  const lower = name.toLowerCase();
  return extensions[format]?.some((extension) => lower.endsWith(extension)) ?? false;
}

export class DownloadController {
  async publicDetails(req: Request, res: Response): Promise<void> {
    const download = await Download.findOne({ _id: req.params.downloadId, status: 'published' }).lean();
    if (!download) {
      res.status(404).json({ success: false, error: { code: 'DOWNLOAD_UNAVAILABLE', message: 'This download is not available.' } });
      return;
    }
    const [app, release] = await Promise.all([
      Application.findOne({ _id: download.application, status: 'published' }).select('name slug').lean(),
      Release.findOne({ _id: download.release, status: 'published' }).select('version releaseDate').lean(),
    ]);
    if (!app || !release) {
      res.status(404).json({ success: false, error: { code: 'DOWNLOAD_UNAVAILABLE', message: 'This download is not available.' } });
      return;
    }
    res.json({
      success: true,
      data: {
        id: download._id,
        application: app,
        release,
        os: download.os,
        architecture: download.architecture,
        format: download.format,
        fileName: download.fileName,
        fileSize: download.fileSize,
        sha256Checksum: download.sha256Checksum,
        checksumVerified: download.checksumVerified,
      },
    });
  }

  async redirect(req: Request, res: Response): Promise<void> {
    const download = await Download.findOne({ _id: req.params.downloadId, status: 'published' });
    if (!download) {
      res.status(404).json({ success: false, error: { code: 'DOWNLOAD_UNAVAILABLE', message: 'This download is not available.' } });
      return;
    }
    const [app, release] = await Promise.all([
      Application.findOne({ _id: download.application, status: 'published' }).select('_id').lean(),
      Release.findOne({ _id: download.release, status: 'published' }).select('_id').lean(),
    ]);
    if (!app || !release) {
      res.status(404).json({ success: false, error: { code: 'DOWNLOAD_UNAVAILABLE', message: 'This download is not available.' } });
      return;
    }

    if (download.storageProvider === 'r2' && download.r2Key && (
      download.r2Bucket !== env.R2_BUCKET_NAME ||
      !(await r2Service.objectExists(download.r2Key, env.R2_BUCKET_NAME))
    )) {
      download.status = 'failed';
      await download.save();
      res.status(503).json({ success: false, error: { code: 'INSTALLER_MISSING', message: 'This installer is temporarily unavailable. Please try again later or contact support.' } });
      return;
    }
    const destination = download.storageProvider === 'external'
      ? download.externalUrl && isSafePublicUrl(download.externalUrl) ? download.externalUrl : undefined
      : download.r2Key
        ? r2Service.getPublicUrl(download.r2Key)
        : undefined;
    if (!destination || !destination.startsWith('https://')) {
      res.status(503).json({ success: false, error: { code: 'DOWNLOAD_NOT_CONFIGURED', message: 'The installer is temporarily unavailable.' } });
      return;
    }

    await DownloadEvent.create({
      download: download._id,
      application: download.application,
      release: download.release,
      os: download.os,
      format: download.format,
      architecture: download.architecture,
      timestamp: new Date(),
    });
    await Promise.all([
      Download.updateOne({ _id: download._id }, { $inc: { downloadCount: 1 } }),
      Application.updateOne({ _id: download.application }, { $inc: { totalDownloads: 1 } }),
    ]);
    res.redirect(302, destination);
  }

  async listAdmin(req: Request, res: Response): Promise<void> {
    const filter = req.params.releaseId ? { release: req.params.releaseId } : {};
    const downloads = await Download.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: downloads });
  }

  async createExternal(req: Request, res: Response): Promise<void> {
    const release = await Release.findById(req.params.releaseId);
    if (!release) {
      res.status(404).json({ success: false, error: { code: 'RELEASE_NOT_FOUND', message: 'Release not found.' } });
      return;
    }
    const data = req.body;
    const app = await Application.findById(release.application).select('supportedPlatforms');
    if (!app?.supportedPlatforms.some((platform) => platform.os === data.os && platform.architectures.includes(data.architecture))) {
      res.status(400).json({ success: false, error: { code: 'UNSUPPORTED_PLATFORM', message: 'Configure this operating system and architecture on the application before adding an installer.' } });
      return;
    }
    if (!validFileName(data.fileName, data.format)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_FILE_EXTENSION', message: 'The file extension must match the selected installer format.' } });
      return;
    }
    const download = await Download.create({
      ...data,
      release: release._id,
      application: release.application,
      status: 'disabled',
      checksumVerified: false,
    });
    await auditService.log(req.admin!.id, 'download.create_external', 'download', download._id.toString(), { provider: 'external' }, req.ip || 'unknown');
    res.status(201).json({ success: true, data: download });
  }

  async initializeUpload(req: Request, res: Response): Promise<void> {
    const release = await Release.findById(req.params.releaseId);
    if (!release) {
      res.status(404).json({ success: false, error: { code: 'RELEASE_NOT_FOUND', message: 'Release not found.' } });
      return;
    }
    const { fileName, fileSize, os, architecture, format } = req.body;
    if (!validFileName(fileName, format)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_FILE_EXTENSION', message: 'The file extension must match the selected installer format.' } });
      return;
    }
    const maximum = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024;
    if (fileSize > maximum) {
      res.status(413).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: `Maximum installer size is ${env.MAX_UPLOAD_SIZE_MB} MB.` } });
      return;
    }
    if (!env.R2_BUCKET_NAME || !r2Service.stagingBucket || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      res.status(503).json({ success: false, error: { code: 'R2_NOT_CONFIGURED', message: 'Cloudflare R2 storage is not configured on the server.' } });
      return;
    }

    const app = await Application.findById(release.application).select('slug supportedPlatforms');
    if (!app) {
      res.status(404).json({ success: false, error: { code: 'APP_NOT_FOUND', message: 'Application not found.' } });
      return;
    }
    if (!app.supportedPlatforms.some((platform) => platform.os === os && platform.architectures.includes(architecture))) {
      res.status(400).json({ success: false, error: { code: 'UNSUPPORTED_PLATFORM', message: 'Configure this operating system and architecture on the application before uploading an installer.' } });
      return;
    }
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const contentType = contentTypes[format];
    const key = r2Service.generateObjectKey(app.slug, release.version, os, architecture, `${randomUUID()}-${safeName}`);
    const isMultipart = fileSize > 100 * 1024 * 1024;
    const upload = isMultipart
      ? await r2Service.initiateMultipartUpload(key, contentType, undefined, r2Service.stagingBucket)
      : await r2Service.getPresignedUploadUrl(key, contentType, fileSize, r2Service.stagingBucket);
    try {
      const download = await Download.create({
        application: app._id,
        release: release._id,
        os,
        architecture,
        format,
        storageProvider: 'r2',
        r2Key: key,
        r2Bucket: r2Service.stagingBucket,
        fileName,
        fileSize,
        mimeType: contentType,
        status: 'uploading',
        uploadId: isMultipart && 'uploadId' in upload ? upload.uploadId : undefined,
      });
      res.status(201).json({
        success: true,
        data: {
          downloadId: download._id,
          key,
          uploadUrl: 'url' in upload ? upload.url : undefined,
          contentType,
          uploadId: 'uploadId' in upload ? upload.uploadId : undefined,
          multipart: isMultipart,
          partSize: 10 * 1024 * 1024,
        },
      });
    } catch (error) {
      if ('uploadId' in upload) await r2Service.abortMultipartUpload(key, upload.uploadId, r2Service.stagingBucket);
      else await r2Service.deleteObject(key, r2Service.stagingBucket);
      throw error;
    }
  }

  async signPart(req: Request, res: Response): Promise<void> {
    const download = await Download.findOne({ _id: req.params.downloadId, status: 'uploading', storageProvider: 'r2' });
    const partNumber = Number(req.params.partNumber);
    const chunkSize = 10 * 1024 * 1024;
    const expectedParts = download ? Math.ceil(download.fileSize / chunkSize) : 0;
    if (!download?.r2Key || !download.uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > expectedParts) {
      res.status(400).json({ success: false, error: { code: 'INVALID_UPLOAD_PART', message: 'Multipart upload or part number is invalid.' } });
      return;
    }
    const contentLength = Math.min(chunkSize, download.fileSize - (partNumber - 1) * chunkSize);
    res.json({ success: true, data: { url: await r2Service.getPresignedPartUrl(download.r2Key, download.uploadId, partNumber, contentLength, download.r2Bucket || r2Service.stagingBucket) } });
  }

  async completeUpload(req: Request, res: Response): Promise<void> {
    const download = await Download.findOne({ _id: req.params.downloadId, status: 'uploading', storageProvider: 'r2' });
    if (!download?.r2Key) {
      res.status(404).json({ success: false, error: { code: 'UPLOAD_NOT_FOUND', message: 'Upload was not found or has already completed.' } });
      return;
    }
    try {
      if (download.uploadId) {
        const parts = req.body.parts;
        if (!parts?.length || parts.length > 10000) {
          res.status(400).json({ success: false, error: { code: 'INVALID_UPLOAD_PARTS', message: 'Multipart uploads require a valid list of completed parts.' } });
          return;
        }
        await r2Service.completeMultipartUpload(download.r2Key, download.uploadId, parts, download.r2Bucket || r2Service.stagingBucket);
      }
      const bucket = download.r2Bucket || r2Service.stagingBucket;
      const metadata = await r2Service.getObjectMetadata(download.r2Key, bucket);
      if (!metadata || metadata.contentLength !== download.fileSize || metadata.contentLength > env.MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
        await r2Service.deleteObject(download.r2Key, bucket);
        download.status = 'failed';
        download.uploadId = undefined;
        await download.save();
        res.status(400).json({ success: false, error: { code: 'UPLOAD_SIZE_MISMATCH', message: 'Uploaded file size did not match the declared size; the object was removed.' } });
        return;
      }
      const checksum = await checksumService.calculateSha256FromStream(await r2Service.getObjectStream(download.r2Key, bucket));
      download.fileSize = metadata.contentLength;
      download.mimeType = metadata.contentType;
      download.sha256Checksum = checksum;
      download.checksumVerified = true;
      download.status = 'uploaded';
      download.uploadProgress = 100;
      download.uploadId = undefined;
      await download.save();
      await auditService.log(req.admin!.id, 'download.upload_complete', 'download', download._id.toString(), { fileSize: metadata.contentLength, checksum }, req.ip || 'unknown');
      res.json({ success: true, data: download });
    } catch (error) {
      download.status = 'failed';
      const uploadId = download.uploadId;
      download.uploadId = undefined;
      await download.save();
      if (uploadId) await r2Service.abortMultipartUpload(download.r2Key, uploadId, download.r2Bucket || r2Service.stagingBucket);
      await r2Service.deleteObject(download.r2Key, download.r2Bucket || r2Service.stagingBucket);
      throw error;
    }
  }

  async cancelUpload(req: Request, res: Response): Promise<void> {
    const download = await Download.findOne({ _id: req.params.downloadId, status: 'uploading', storageProvider: 'r2' });
    if (!download?.r2Key) {
      res.status(404).json({ success: false, error: { code: 'UPLOAD_NOT_FOUND', message: 'Upload was not found.' } });
      return;
    }
    const bucket = download.r2Bucket || r2Service.stagingBucket;
    if (download.uploadId) await r2Service.abortMultipartUpload(download.r2Key, download.uploadId, bucket);
    else await r2Service.deleteObject(download.r2Key, bucket);
    download.status = 'failed';
    download.uploadId = undefined;
    await download.save();
    res.json({ success: true, message: 'Upload cancelled and temporary object removed.' });
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    const download = await Download.findById(req.params.downloadId);
    if (!download) {
      res.status(404).json({ success: false, error: { code: 'DOWNLOAD_NOT_FOUND', message: 'Download not found.' } });
      return;
    }
    if (req.body.status === 'published') {
      const [app, release] = await Promise.all([
        Application.findOne({ _id: download.application, status: 'published' }).select('_id').lean(),
        Release.findOne({ _id: download.release, status: 'published' }).select('_id').lean(),
      ]);
      if (!app || !release) {
        res.status(409).json({ success: false, error: { code: 'PARENT_NOT_PUBLISHED', message: 'Publish the application and release before publishing an installer.' } });
        return;
      }
      if (download.storageProvider === 'r2' && (
        !['uploaded', 'published', 'disabled'].includes(download.status) ||
        !download.r2Key ||
        !download.checksumVerified
      )) {
        res.status(409).json({ success: false, error: { code: 'UPLOAD_NOT_VERIFIED', message: 'Complete and verify the R2 upload before publishing.' } });
        return;
      }
      await downloadStorageService.publish(download);
    } else if (req.body.status === 'disabled') {
      await downloadStorageService.unpublish(download);
    }
    download.status = req.body.status;
    await download.save();
    await auditService.log(req.admin!.id, 'download.status_change', 'download', download._id.toString(), { status: download.status }, req.ip || 'unknown');
    res.json({ success: true, data: download });
  }

  async delete(req: Request, res: Response): Promise<void> {
    if (req.query.confirm !== 'true') {
      res.status(400).json({ success: false, error: { code: 'CONFIRMATION_REQUIRED', message: 'Pass confirm=true to explicitly delete this installer entry and its R2 object.' } });
      return;
    }
    const download = await Download.findById(req.params.downloadId);
    if (!download) {
      res.status(404).json({ success: false, error: { code: 'DOWNLOAD_NOT_FOUND', message: 'Download not found.' } });
      return;
    }
    if (download.storageProvider === 'r2' && download.r2Key) {
      const bucket = download.r2Bucket || (
        download.status === 'published' ? env.R2_BUCKET_NAME : r2Service.stagingBucket
      );
      if (download.uploadId) await r2Service.abortMultipartUpload(download.r2Key, download.uploadId, bucket);
      else await r2Service.deleteObject(download.r2Key, bucket);
    }
    await Download.findByIdAndDelete(download._id);
    await auditService.log(req.admin!.id, 'download.delete', 'download', download._id.toString(), { fileName: download.fileName }, req.ip || 'unknown');
    res.json({ success: true, message: 'Download entry deleted.' });
  }
}

export const downloadController = new DownloadController();
