import mongoose from 'mongoose';
import { DownloadEvent } from '../models/DownloadEvent.js';
import { Download } from '../models/Download.js';
import { Application } from '../models/Application.js';
import { Release } from '../models/Release.js';
import {
  DownloadEventInput,
  DashboardStats,
  OsStats,
  DailyStats,
  MonthlyStats,
  TopApp,
} from '../types/index.js';

export class AnalyticsService {
  /**
   * Record a download event and increment download counters
   */
  async recordDownloadEvent(data: DownloadEventInput): Promise<void> {
    const downloadOid = new mongoose.Types.ObjectId(data.downloadId);
    const appOid = new mongoose.Types.ObjectId(data.applicationId);
    const releaseOid = new mongoose.Types.ObjectId(data.releaseId);

    // Save the event document
    await DownloadEvent.create({
      download: downloadOid,
      application: appOid,
      release: releaseOid,
      os: data.os,
      format: data.format,
      architecture: data.architecture,
      timestamp: new Date(),
      userAgent: data.userAgent,
      country: data.country,
      sessionId: data.sessionId,
    });

    // Increment download count on Download model
    await Download.findByIdAndUpdate(downloadOid, {
      $inc: { downloadCount: 1 },
    });

    // Increment download count on Application model
    await Application.findByIdAndUpdate(appOid, {
      $inc: { totalDownloads: 1 },
    });
  }

  /**
   * Get high-level dashboard metrics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const [
      totalApplications,
      draftApplications,
      publishedApplications,
      totalReleases,
      totalDownloadsCount,
      totalDownloadEvents,
      failedDownloads,
      recentUploadsCount,
    ] = await Promise.all([
      Application.countDocuments(),
      Application.countDocuments({ status: 'draft' }),
      Application.countDocuments({ status: 'published' }),
      Release.countDocuments(),
      Download.countDocuments(),
      DownloadEvent.countDocuments(),
      Download.countDocuments({ status: 'failed' }),
      Download.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    return {
      totalApplications,
      draftApplications,
      publishedApplications,
      totalReleases,
      totalDownloads: totalDownloadsCount,
      totalDownloadEvents,
      failedDownloads,
      recentUploadsCount,
    };
  }

  /**
   * Get downloads grouped by application within a date range
   */
  async getDownloadsByApp(
    appId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; count: number }[]> {
    const appOid = new mongoose.Types.ObjectId(appId);

    const result = await DownloadEvent.aggregate([
      {
        $match: {
          application: appOid,
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1,
        },
      },
    ]);

    return result;
  }

  /**
   * Get downloads grouped by Operating System within a date range
   */
  async getDownloadsByOS(startDate: Date, endDate: Date): Promise<OsStats[]> {
    const totalCount = await DownloadEvent.countDocuments({
      timestamp: { $gte: startDate, $lte: endDate },
    });

    const results = await DownloadEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$os',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return results.map((item) => ({
      os: item._id,
      count: item.count,
      percentage: totalCount > 0 ? Math.round((item.count / totalCount) * 1000) / 10 : 0,
    }));
  }

  /**
   * Get daily downloads between startDate and endDate
   */
  async getDailyDownloads(startDate: Date, endDate: Date): Promise<DailyStats[]> {
    const results = await DownloadEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          count: 1,
        },
      },
    ]);

    return results;
  }

  /**
   * Get monthly downloads for a specific year
   */
  async getMonthlyDownloads(year: number): Promise<MonthlyStats[]> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    const results = await DownloadEvent.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: '$_id',
          count: 1,
        },
      },
    ]);

    return results;
  }

  /**
   * Get top applications sorted by download count
   */
  async getTopApplications(limit = 10): Promise<TopApp[]> {
    const apps = await Application.find({ status: 'published' })
      .sort({ totalDownloads: -1 })
      .limit(limit)
      .select('_id name slug category icon totalDownloads')
      .lean();

    return apps.map((app) => ({
      _id: app._id.toString(),
      name: app.name,
      slug: app.slug,
      category: app.category,
      icon: app.icon ? { key: app.icon.key, url: app.icon.url } : undefined,
      totalDownloads: app.totalDownloads || 0,
    }));
  }
}

export const analyticsService = new AnalyticsService();
