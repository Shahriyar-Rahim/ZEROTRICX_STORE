import { Request, Response } from 'express';
import { Application } from '../models/Application.js';
import { Release } from '../models/Release.js';
import { Download } from '../models/Download.js';
import { Review } from '../models/Review.js';
import { env } from '../config/env.js';
import { r2Service } from '../services/r2Service.js';
import { downloadStorageService } from '../services/downloadStorageService.js';
import { auditService } from '../services/auditService.js';
import { cloudinaryService } from '../services/cloudinaryService.js';
import { ApplicationQueryParams } from '../validators/application.js';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ApplicationController {
  async githubPreview(req: Request, res: Response): Promise<void> {
    const githubUrl = String(req.body.githubUrl || '').trim();
    const match = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)\/?$/.exec(githubUrl);
    if (!match || match[2].toLowerCase() === 'settings') {
      res.status(400).json({ success: false, error: { code: 'INVALID_GITHUB_URL', message: 'Enter a public GitHub repository URL such as https://github.com/owner/repository.' } });
      return;
    }
    const [, owner, repository] = match;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Northstar-Software-Store',
    };
    if (env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    }
    const upstream = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`, {
      headers,
      signal: AbortSignal.timeout(7000),
    });
    if (upstream.status === 404) {
      res.status(404).json({ success: false, error: { code: 'GITHUB_REPOSITORY_NOT_FOUND', message: 'That GitHub repository is not public or could not be found.' } });
      return;
    }
    if (!upstream.ok) {
      const rateLimited = upstream.status === 429 || upstream.status === 403;
      res.status(502).json({ success: false, error: { code: 'GITHUB_UNAVAILABLE', message: rateLimited ? 'GitHub API rate limit reached. Try again later.' : 'GitHub could not provide repository details right now.' } });
      return;
    }
    const data = await upstream.json() as {
      html_url?: string; name?: string; description?: string | null; homepage?: string | null;
      license?: { spdx_id?: string | null } | null; topics?: string[]; archived?: boolean; fork?: boolean;
    };
    const name = String(data.name || repository).slice(0, 100);
    const shortDescription = String(data.description || '').slice(0, 200);
    res.json({
      success: true,
      data: {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100),
        shortDescription,
        description: data.description || '',
        category: '',
        features: (data.topics || []).slice(0, 20),
        githubUrl: data.html_url || githubUrl,
        websiteUrl: data.homepage || '',
        license: data.license?.spdx_id && data.license.spdx_id !== 'NOASSERTION' ? data.license.spdx_id : '',
        repositoryArchived: Boolean(data.archived),
        repositoryIsFork: Boolean(data.fork),
      },
    });
  }

  async uploadImage(req: Request, res: Response): Promise<void> {
    const app = await Application.findById(req.params.appId);
    if (!app) {
      res.status(404).json({ success: false, error: { code: 'APP_NOT_FOUND', message: 'Application not found.' } });
      return;
    }
    const kind = req.params.kind;
    if (kind !== 'icon' && kind !== 'screenshot') {
      res.status(400).json({ success: false, error: { code: 'INVALID_IMAGE_KIND', message: 'Image kind must be icon or screenshot.' } });
      return;
    }
    const image = req.file;
    if (!image) {
      res.status(400).json({ success: false, error: { code: 'IMAGE_REQUIRED', message: 'Choose an image file to upload.' } });
      return;
    }
    if (!cloudinaryService.isConfigured()) {
      res.status(503).json({ success: false, error: { code: 'IMAGE_STORAGE_UNAVAILABLE', message: 'Cloudinary image storage is not configured on the server.' } });
      return;
    }
    const limit = (kind === 'icon' ? env.MAX_ICON_SIZE_MB : env.MAX_SCREENSHOT_SIZE_MB) * 1024 * 1024;
    if (image.size > limit) {
      res.status(413).json({ success: false, error: { code: 'IMAGE_TOO_LARGE', message: `${kind === 'icon' ? 'Icon' : 'Screenshot'} exceeds the ${kind === 'icon' ? env.MAX_ICON_SIZE_MB : env.MAX_SCREENSHOT_SIZE_MB} MB limit.` } });
      return;
    }

    const uploaded = await cloudinaryService.uploadImage(image.buffer, app._id.toString(), image.originalname);
    const asset = {
      key: uploaded.public_id,
      url: uploaded.secure_url,
      mimeType: image.mimetype,
    };
    const oldIconKey = app.icon?.key;
    if (kind === 'icon') {
      app.icon = asset;
    } else {
      app.screenshots.push({
        ...asset,
        caption: String(req.body.caption || '').trim().slice(0, 200),
        order: app.screenshots.length,
      });
    }
    try {
      await app.save();
    } catch (error) {
      await cloudinaryService.deleteImage(uploaded.public_id);
      throw error;
    }
    if (kind === 'icon' && oldIconKey?.startsWith(`software-store/apps/${app._id}/`)) {
      await cloudinaryService.deleteImage(oldIconKey);
    }

    await auditService.log(req.admin!.id, `application.image.${kind}.upload`, 'application', app._id.toString(), { publicId: uploaded.public_id }, req.ip || 'unknown');
    res.status(201).json({ success: true, data: kind === 'icon' ? app.icon : app.screenshots[app.screenshots.length - 1] });
  }

  async deleteImage(req: Request, res: Response): Promise<void> {
    const app = await Application.findById(req.params.appId);
    if (!app) {
      res.status(404).json({ success: false, error: { code: 'APP_NOT_FOUND', message: 'Application not found.' } });
      return;
    }
    const { kind, key } = req.body as { kind?: string; key?: string };
    if (!key || !key.startsWith(`software-store/apps/${app._id}/`)) {
      res.status(400).json({ success: false, error: { code: 'INVALID_IMAGE_KEY', message: 'Image asset does not belong to this application.' } });
      return;
    }

    if (kind === 'icon' && app.icon?.key === key) {
      app.icon = undefined;
    } else if (kind === 'screenshot') {
      const screenshot = app.screenshots.find((item) => item.key === key);
      if (!screenshot) {
        res.status(404).json({ success: false, error: { code: 'IMAGE_NOT_FOUND', message: 'Image not found.' } });
        return;
      }
      const index = app.screenshots.findIndex((item) => item.key === key);
      app.screenshots.splice(index, 1);
      app.screenshots.forEach((item, index) => { item.order = index; });
    } else {
      res.status(404).json({ success: false, error: { code: 'IMAGE_NOT_FOUND', message: 'Image not found.' } });
      return;
    }

    await app.save();
    await cloudinaryService.deleteImage(key);
    await auditService.log(req.admin!.id, 'application.image.delete', 'application', app._id.toString(), { publicId: key }, req.ip || 'unknown');
    res.json({ success: true, data: app });
  }

  private async disablePublishedDownloads(filter: Record<string, unknown>): Promise<void> {
    const downloads = await Download.find({ ...filter, status: 'published' });
    for (const download of downloads) {
      await downloadStorageService.unpublish(download);
      download.status = 'disabled';
      await download.save();
    }
  }

  /**
   * Public: List published apps with search, filtering, and pagination
   */
  async listPublicApps(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as ApplicationQueryParams;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 12));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { status: 'published' };

    if (query.category) {
      filter.category = query.category;
    }

    if (query.os) {
      filter['supportedPlatforms.os'] = query.os;
    }

    if (query.isFeatured !== undefined) {
      filter.isFeatured = query.isFeatured;
    }
    if (query.isPinned !== undefined) {
      filter.isPinned = query.isPinned;
    }

    let sortOption: Record<string, any> = { totalDownloads: -1 };
    if (query.sort === 'newest') {
      sortOption = { createdAt: query.order === 'asc' ? 1 : -1 };
    } else if (query.sort === 'name') {
      sortOption = { name: query.order === 'desc' ? -1 : 1 };
    } else if (query.sort === 'updated') {
      sortOption = { updatedAt: query.order === 'asc' ? 1 : -1 };
    } else {
      sortOption = { totalDownloads: query.order === 'asc' ? 1 : -1 };
    }

    if (query.search && query.search.trim()) {
      filter.$text = { $search: query.search.trim() };
    }

    const [apps, total] = await Promise.all([
      Application.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select('-installationInstructions -seoKeywords')
        .lean(),
      Application.countDocuments(filter),
    ]);
    const ratingSummaries = apps.length
      ? await Review.aggregate([
        { $match: { application: { $in: apps.map((app) => app._id) }, status: 'approved' } },
        { $group: { _id: '$application', average: { $avg: '$rating' }, count: { $sum: 1 } } },
      ])
      : [];
    const summariesByApp = new Map(ratingSummaries.map((summary) => [summary._id.toString(), summary]));

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      data: apps.map((app) => {
        const summary = summariesByApp.get(app._id.toString());
        return {
          ...app,
          ratingAverage: summary?.average ?? 4,
          reviewCount: summary?.count ?? 0,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  }

  /**
   * Public: Get single published app by slug, including published releases and active downloads
   */
  async getPublicApp(req: Request, res: Response): Promise<void> {
    const { slug } = req.params;

    const app = await Application.findOne({ slug: slug.toLowerCase(), status: 'published' }).lean();

    if (!app) {
      res.status(404).json({
        success: false,
        error: {
          code: 'APP_NOT_FOUND',
          message: 'The requested application was not found or is not currently published',
        },
      });
      return;
    }

    // Fetch published releases
    const releases = await Release.find({
      application: app._id,
      status: 'published',
    })
      .sort({ releaseDate: -1 })
      .lean();

    // Fetch published downloads for those releases
    const releaseIds = releases.map((r) => r._id);
    const downloads = await Download.find({
      application: app._id,
      release: { $in: releaseIds },
      status: 'published',
    }).lean();

    // Attach downloads to their corresponding releases
    const releasesWithDownloads = releases.map((release) => ({
      ...release,
      downloads: downloads
        .filter((d) => d.release.toString() === release._id.toString())
        .map((d) => ({
          _id: d._id,
          os: d.os,
          architecture: d.architecture,
          format: d.format,
          fileName: d.fileName,
          fileSize: d.fileSize,
          sha256Checksum: d.sha256Checksum,
          checksumVerified: d.checksumVerified,
          downloadCount: d.downloadCount,
        })),
    }));

    res.status(200).json({
      success: true,
      data: {
        ...app,
        releases: releasesWithDownloads,
      },
    });
  }

  /**
   * Public: Get distinct categories
   */
  async getCategories(_req: Request, res: Response): Promise<void> {
    const categories = await Application.distinct('category', { status: 'published' });
    res.status(200).json({
      success: true,
      data: categories.filter(Boolean),
    });
  }

  /**
   * Admin: List all applications (all statuses)
   */
  async adminListApps(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.search) {
      const search = escapeRegex(String(req.query.search).slice(0, 100));
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const [apps, total] = await Promise.all([
      Application.find(filter).sort({ isPinned: -1, updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Application.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      data: apps,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  }

  /**
   * Admin: Get single application by ID
   */
  async adminGetApp(req: Request, res: Response): Promise<void> {
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

    res.status(200).json({
      success: true,
      data: app,
    });
  }

  /**
   * Admin: Create new application
   */
  async createApp(req: Request, res: Response): Promise<void> {
    const app = new Application(req.body);
    await app.save();

    await auditService.log(
      req.admin!.id,
      'app.create',
      'application',
      app._id.toString(),
      { name: app.name, slug: app.slug },
      req.ip || 'unknown'
    );

    res.status(201).json({
      success: true,
      data: app,
    });
  }

  /**
   * Admin: Update application
   */
  async updateApp(req: Request, res: Response): Promise<void> {
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

    const wasPublished = app.status === 'published';
    Object.assign(app, req.body);
    if (wasPublished && app.status !== 'published') {
      await this.disablePublishedDownloads({ application: app._id });
    }
    await app.save();

    await auditService.log(
      req.admin!.id,
      'app.update',
      'application',
      app._id.toString(),
      req.body,
      req.ip || 'unknown'
    );

    res.status(200).json({
      success: true,
      data: app,
    });
  }

  /**
   * Admin: Delete application and all cascade data (releases, downloads, R2 objects)
   */
  async deleteApp(req: Request, res: Response): Promise<void> {
    const { appId } = req.params;
    if (req.query.confirm !== 'true') {
      res.status(400).json({
        success: false,
        error: { code: 'CONFIRMATION_REQUIRED', message: 'Pass confirm=true to delete the application, releases, download records, and associated R2 objects.' },
      });
      return;
    }
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

    // Find all downloads for this application to clean up R2 objects
    const downloads = await Download.find({ application: app._id });
    for (const d of downloads) {
      if (d.storageProvider === 'r2' && d.r2Key) {
        await r2Service.deleteObject(d.r2Key, d.r2Bucket || env.R2_BUCKET_NAME);
      }
    }

    const imageKeys = [app.icon?.key, ...app.screenshots.map((image) => image.key)]
      .filter((key): key is string => Boolean(key?.startsWith(`software-store/apps/${app._id}/`)));
    for (const key of imageKeys) {
      await cloudinaryService.deleteImage(key);
    }

    // Cascade delete downloads and releases
    await Download.deleteMany({ application: app._id });
    await Release.deleteMany({ application: app._id });
    await Application.findByIdAndDelete(appId);

    await auditService.log(
      req.admin!.id,
      'app.delete',
      'application',
      app._id.toString(),
      { name: app.name, slug: app.slug },
      req.ip || 'unknown'
    );

    res.status(200).json({
      success: true,
      message: 'Application and associated releases and downloads deleted successfully',
    });
  }

  /**
   * Admin: Toggle featured status
   */
  async toggleFeatured(req: Request, res: Response): Promise<void> {
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

    app.isFeatured = !app.isFeatured;
    await app.save();

    await auditService.log(
      req.admin!.id,
      'app.toggle_featured',
      'application',
      app._id.toString(),
      { isFeatured: app.isFeatured },
      req.ip || 'unknown'
    );

    res.status(200).json({
      success: true,
      data: { isFeatured: app.isFeatured },
    });
  }

  async togglePinned(req: Request, res: Response): Promise<void> {
    const app = await Application.findById(req.params.appId);
    if (!app) {
      res.status(404).json({ success: false, error: { code: 'APP_NOT_FOUND', message: 'Application not found.' } });
      return;
    }
    app.isPinned = !app.isPinned;
    await app.save();
    await auditService.log(req.admin!.id, 'app.toggle_pinned', 'application', app._id.toString(), { isPinned: app.isPinned }, req.ip || 'unknown');
    res.json({ success: true, data: { isPinned: app.isPinned } });
  }

  /**
   * Admin: Change publication status
   */
  async changeStatus(req: Request, res: Response): Promise<void> {
    const { appId } = req.params;
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

    if (app.status === 'published' && status !== 'published') {
      await this.disablePublishedDownloads({ application: app._id });
    }
    app.status = status;
    await app.save();

    await auditService.log(
      req.admin!.id,
      'app.status_change',
      'application',
      app._id.toString(),
      { newStatus: status },
      req.ip || 'unknown'
    );

    res.status(200).json({
      success: true,
      data: app,
    });
  }
}

export const applicationController = new ApplicationController();
