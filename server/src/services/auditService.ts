import mongoose from 'mongoose';
import { AuditLog, IAuditLogDocument } from '../models/AuditLog.js';

export class AuditService {
  async log(
    adminId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: any,
    ipAddress?: string
  ): Promise<void> {
    try {
      await AuditLog.create({
        admin: new mongoose.Types.ObjectId(adminId),
        action,
        resourceType,
        resourceId: resourceId ? new mongoose.Types.ObjectId(resourceId) : undefined,
        details: details || {},
        timestamp: new Date(),
      });
    } catch (err) {
      console.error(`Failed to write audit log (${err instanceof Error ? err.name : 'unknown error'}).`);
    }
  }

  async getRecentLogs(limit = 50): Promise<IAuditLogDocument[]> {
    return AuditLog.find()
      .populate('admin', 'username email role')
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async getLogsByResource(resourceType: string, resourceId: string): Promise<IAuditLogDocument[]> {
    return AuditLog.find({
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
    })
      .populate('admin', 'username email role')
      .sort({ timestamp: -1 })
      .exec();
  }
}

export const auditService = new AuditService();
