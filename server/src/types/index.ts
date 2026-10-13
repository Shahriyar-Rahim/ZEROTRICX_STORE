import { Request } from 'express';

export interface AdminTokenPayload {
  id: string;
  username: string;
  email: string;
  role: 'superadmin' | 'admin';
  sessionVersion: number;
}

export interface AuthenticatedRequest extends Request {
  admin?: AdminTokenPayload;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface DashboardStats {
  totalApplications: number;
  draftApplications: number;
  publishedApplications: number;
  totalReleases: number;
  totalDownloads: number;
  totalDownloadEvents: number;
  failedDownloads: number;
  recentUploadsCount: number;
}

export interface OsStats {
  os: string;
  count: number;
  percentage: number;
}

export interface DownloadStats {
  applicationId: string;
  applicationName: string;
  slug: string;
  downloads: number;
}

export interface DailyStats {
  date: string;
  count: number;
}

export interface MonthlyStats {
  month: string;
  count: number;
}

export interface TopApp {
  _id: string;
  name: string;
  slug: string;
  category: string;
  icon?: {
    key: string;
    url: string;
  };
  totalDownloads: number;
}

export interface DownloadEventInput {
  downloadId: string;
  applicationId: string;
  releaseId: string;
  os: string;
  format: string;
  architecture: string;
  userAgent?: string;
  country?: string;
  sessionId?: string;
}
