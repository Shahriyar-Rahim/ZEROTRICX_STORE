import { Request, Response } from 'express';
import { Release } from '../models/Release.js';
import { Application } from '../models/Application.js';
import { Download } from '../models/Download.js';
import { r2Service } from '../services/r2Service.js';
import { downloadStorageService } from '../services/downloadStorageService.js';
import { auditService } from '../services/auditService.js';
import { env } from '../config/env.js';

export class ReleaseController {
  private async disablePublishedDownloads(releaseId: unknown): Promise<void> {
    const downloads = await Download.find({ release: releaseId, status: 'published' });
    for (const download of downloads) {
      await downloadStorageService.unpublish(download);
      download.status = 'disabled';
      await download.save();
    }
  }

  private async syncCurrentVersion(applicationId: string): Promise<void> {
    const latest = await Release.findOne({ application: applicationId, status: 'published' })
      .sort({ releaseDate: -1, createdAt: -1 })
      .select('version')
      .lean();
    if (latest) {
      await Application.findByIdAndUpdate(applicationId, { $set: { currentVersion: latest.version } });
    } else {
      await Application.findByIdAndUpdate(applicationId, { $unset: { currentVersion: 1 } });
    }
  }

  /**
   * Public: Get single published release by ID with enabled downloads
   */
  async getPublicRelease(req: Request, res: Response): Promise<void> {
    const { releaseId } = req.params;

    const release = await Release.findOne({
      _id: releaseId,
      status: 'published',
    }).lean();

    if (!release) {
      res.status(404).json({
        success: false,
        error: {
          code: 'RELEASE_NOT_FOUND',
          message: 'The requested release was not found or is not published',
        },
      });
      return;
    }

    const application = await Application.findOne({ _id: release.application, status: 'published' }).select('name slug icon category').lean();
    if (!application) {
      res.status(404).json({
        success: false,
        error: { code: 'RELEASE_NOT_FOUND', message: 'The requested release was not found or is not published' },
      });
      return;
    }

    const downloads = await Download.find({
      release: release._id,
      status: 'published',
    }).select('os architecture format fileName fileSize sha256Checksum checksumVerified downloadCount').lean();

    res.status(200).json({
      success: true,
      data: {
        ...release,
        application,
        downloads,
      },
    });
  }

  /**
   * Admin: List releases for a specific application
   */
  async adminListReleases(req: Request, res: Response): Promise<void> {
    const { appId } = req.params;

    const app = await Application.findById(appId);
    if (!app) {
      res.status(404).json({
        success: false,
        error: {
          code: 'APP_NOT_FOUND',
          message: 'Application not found',
        },
      });
      return;
    }

    const releases = await Release.find({ application: appId })
      .sort({ releaseDate: -1, createdAt: -1 })
      .lean();

    // Include installer metadata for the protected release manager.
    const releaseIds = releases.map((r) => r._id);
    const downloads = await Download.find({ release: { $in: releaseIds } }).lean();

    const releasesWithMeta = releases.map((r) => ({
      ...r,
      downloads: downloads.filter((d) => d.release.toString() === r._id.toString()),
    }));

    res.status(200).json({
      success: true,
      data: releasesWithMeta,
    });
  }

  /**
   * Admin: Get single release details
   */
  async adminGetRelease(req: Request, res: Response): Promise<void> {
    const { releaseId } = req.params;

    const release = await Release.findById(releaseId).populate('application', 'name slug');
    if (!release) {
      res.status(404).json({
        success: false,
        error: {
          code: 'RELEASE_NOT_FOUND',
          message: 'Release not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: release,
    });
  }

  /**
   * Admin: Create a new release for an application
   */
  async createRelease(req: Request, res: Response): Promise<void> {
    const { appId } = req.params;

    const app = await Application.findById(appId);
    if (!app) {
      res.status(404).json({
        success: false,
        error: {
          code: 'APP_NOT_FOUND',
          message: 'Application not found',
        },
      });
      return;
    }
    if (req.body.status === 'published' && app.status !== 'published') {
      res.status(409).json({
        success: false,
        error: { code: 'APPLICATION_NOT_PUBLISHED', message: 'Publish the application before publishing a release.' },
      });
      return;
    }

    const existing = await Release.findOne({ application: appId, version: req.body.version });
    if (existing) {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_VERSION',
          message: `Release version ${req.body.version} already exists for this application`,
        },
      });
      return;
    }

    const release = new Release({
      ...req.body,
      application: app._id,
    });
    await release.save();

    // If published, update currentVersion on Application if not already set or updated
    await this.syncCurrentVersion(appId);

    await auditService.log(
      req.admin!.id,
      'release.create',
      'release',
      release._id.toString(),
      { appId, version: release.version },
      req.ip || 'unknown'
    );

    res.status(201).json({
      success: true,
      data: release,
    });
  }

  /**
   * Admin: Update release details
   */
  async updateRelease(req: Request, res: Response): Promise<void> {
    const { releaseId } = req.params;

    const release = await Release.findById(releaseId);
    if (!release) {
      res.status(404).json({
        success: false,
        error: {
          code: 'RELEASE_NOT_FOUND',
          message: 'Release not found',
        },
      });
      return;
    }

    const wasPublished = release.status === 'published';
    Object.assign(release, req.body);
    if (release.status === 'published') {
      const app = await Application.findOne({ _id: release.application, status: 'published' }).select('_id').lean();
      if (!app) {
        res.status(409).json({
          success: false,
          error: { code: 'APPLICATION_NOT_PUBLISHED', message: 'Publish the application before publishing a release.' },
        });
        return;
      }
    }
    if (wasPublished && release.status !== 'published') {
      await this.disablePublishedDownloads(release._id);
    }
    await release.save();

    await this.syncCurrentVersion(release.application.toString());

    await auditService.log(
      req.admin!.id,
      'release.update',
      'release',
      release._id.toString(),
      req.body,
      req.ip || 'unknown'
    );

    res.status(200).json({
      success: true,
      data: release,
    });
  }

  /**
   * Admin: Delete release and associated downloads / R2 storage objects
   */
  async deleteRelease(req: Request, res: Response): Promise<void> {
    const { releaseId } = req.params;
    if (req.query.confirm !== 'true') {
      res.status(400).json({
        success: false,
        error: { code: 'CONFIRMATION_REQUIRED', message: 'Pass confirm=true to delete the release, its download records, and associated R2 objects.' },
      });
      return;
    }
    const release = await Release.findById(releaseId);
    if (!release) {
      res.status(404).json({
        success: false,
        error: {
          code: 'RELEASE_NOT_FOUND',
          message: 'Release not found',
        },
      });
      return;
    }

    // Clean up R2 objects for associated downloads
    const downloads = await Download.find({ release: release._id });
    for (const d of downloads) {
      if (d.storageProvider === 'r2' && d.r2Key) {
        await r2Service.deleteObject(d.r2Key, d.r2Bucket || env.R2_BUCKET_NAME);
      }
    }

    await Download.deleteMany({ release: release._id });
    await Release.findByIdAndDelete(releaseId);
    await this.syncCurrentVersion(release.application.toString());

    await auditService.log(
      req.admin!.id,
      'release.delete',
      'release',
      release._id.toString(),
      { version: release.version, application: release.application },
      req.ip || 'unknown'
    );

    res.status(200).json({
      success: true,
      message: 'Release and related downloads deleted successfully',
    });
  }

  /**
   * Admin: Change release status (draft/published/archived)
   */
  async changeStatus(req: Request, res: Response): Promise<void> {
    const { releaseId } = req.params;
    const { status } = req.body;

    if (!['draft', 'published', 'archived'].includes(status)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Status must be one of: draft, published, archived',
        },
      });
      return;
    }

    const release = await Release.findById(releaseId);

    if (!release) {
      res.status(404).json({
        success: false,
        error: {
          code: 'RELEASE_NOT_FOUND',
          message: 'Release not found',
        },
      });
      return;
    }

    if (status === 'published') {
      const app = await Application.findOne({ _id: release.application, status: 'published' }).select('_id').lean();
      if (!app) {
        res.status(409).json({
          success: false,
          error: { code: 'APPLICATION_NOT_PUBLISHED', message: 'Publish the application before publishing a release.' },
        });
        return;
      }
    }
    if (release.status === 'published' && status !== 'published') {
      await this.disablePublishedDownloads(release._id);
    }
    release.status = status;
    await release.save();

    await this.syncCurrentVersion(release.application.toString());

    await auditService.log(
      req.admin!.id,
      'release.status_change',
      'release',
      release._id.toString(),
      { newStatus: status },
      req.ip || 'unknown'
    );

    res.status(200).json({
      success: true,
      data: release,
    });
  }
}

export const releaseController = new ReleaseController();
