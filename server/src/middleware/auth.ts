import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Admin } from '../models/Admin.js';
import { AdminTokenPayload } from '../types/index.js';

export const AUTH_COOKIE_NAME = 'auth_token';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token required',
        },
      });
      return;
    }

    let decoded: AdminTokenPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as AdminTokenPayload;
    } catch (jwtErr) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Session has expired or token is invalid. Please log in again.',
        },
      });
      return;
    }

    // Verify admin still exists in database and account is not locked
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      res.status(401).json({
        success: false,
        error: {
          code: 'ADMIN_NOT_FOUND',
          message: 'The account associated with this token does not exist.',
        },
      });
      return;
    }
    if (decoded.sessionVersion !== admin.sessionVersion) {
      res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_REVOKED',
          message: 'This administrator session has been signed out. Please sign in again.',
        },
      });
      return;
    }

    if (admin.isLocked()) {
      res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to excessive failed attempts.',
        },
      });
      return;
    }

    req.admin = {
      id: admin._id.toString(),
      username: admin.username,
      email: admin.email,
      role: admin.role,
      sessionVersion: admin.sessionVersion,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.admin?.role !== 'superadmin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Superadmin privileges required to perform this action',
        },
      });
      return;
    }
    next();
  });
}
