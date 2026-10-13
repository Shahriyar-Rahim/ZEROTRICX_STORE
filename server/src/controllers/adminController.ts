import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService.js';
import { Download } from '../models/Download.js';
import { StoreSettings } from '../models/StoreSettings.js';
import { auditService } from '../services/auditService.js';

export class AdminController {
  async dashboard(_req: Request, res: Response): Promise<void> {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [stats, operatingSystems, daily, monthly, topApplications, recentUploads] = await Promise.all([
      analyticsService.getDashboardStats(),
      analyticsService.getDownloadsByOS(start, now),
      analyticsService.getDailyDownloads(start, now),
      analyticsService.getMonthlyDownloads(now.getFullYear()),
      analyticsService.getTopApplications(8),
      Download.find().sort({ createdAt: -1 }).limit(8).select('fileName status storageProvider fileSize createdAt application release').lean(),
    ]);
    res.json({ success: true, data: { stats, operatingSystems, daily, monthly, topApplications, recentUploads } });
  }

  async monthlyAnalytics(req: Request, res: Response): Promise<void> {
    const rawYear = Number(req.query.year) || new Date().getFullYear();
    if (!Number.isInteger(rawYear) || rawYear < 2000 || rawYear > new Date().getFullYear()) {
      res.status(400).json({ success: false, error: { code: 'INVALID_YEAR', message: 'Year must be between 2000 and the current year.' } });
      return;
    }
    res.json({ success: true, data: await analyticsService.getMonthlyDownloads(rawYear) });
  }

  async getSettings(_req: Request, res: Response): Promise<void> {
    const settings = await StoreSettings.getSettings();
    res.json({ success: true, data: settings });
  }

  async updateSettings(req: Request, res: Response): Promise<void> {
    const settings = await StoreSettings.getSettings();
    Object.assign(settings, req.body);
    await settings.save();
    await auditService.log(req.admin!.id, 'settings.update', 'settings', settings._id.toString(), Object.keys(req.body), req.ip || 'unknown');
    res.json({ success: true, data: settings });
  }

  async auditLogs(req: Request, res: Response): Promise<void> {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const logs = await auditService.getRecentLogs(limit);
    res.json({ success: true, data: logs });
  }
}

export const adminController = new AdminController();
