import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { authController } from './controllers/authController.js';
import { applicationController } from './controllers/applicationController.js';
import { releaseController } from './controllers/releaseController.js';
import { downloadController } from './controllers/downloadController.js';
import { adminController } from './controllers/adminController.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter, loginLimiter, adminRateLimiter, downloadLimiter, uploadLimiter, reviewLimiter } from './middleware/rateLimiter.js';
import { validate, validateQuery } from './middleware/validate.js';
import { changePasswordSchema, currentPasswordSchema, emailChangeSchema, emailCodeSchema, loginSchema, verifyTwoFactorSchema } from './validators/auth.js';
import { createApplicationSchema, updateApplicationSchema, applicationQuerySchema } from './validators/application.js';
import { createReleaseSchema, updateReleaseSchema } from './validators/release.js';
import { externalDownloadSchema, uploadInitSchema, updateDownloadStatusSchema } from './validators/download.js';
import { updateSettingsSchema } from './validators/settings.js';
import { Application } from './models/Application.js';
import { StoreSettings } from './models/StoreSettings.js';
import { imageUpload } from './middleware/imageUpload.js';
import { reviewController } from './controllers/reviewController.js';
import { createReviewSchema, moderateReviewSchema } from './validators/review.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.use(helmet());
app.use(cors({
  origin(origin, callback) { callback(null, !origin || origin === env.CLIENT_URL); },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(generalLimiter);

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;
const asyncHandler = (handler: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.get('/api/settings/public', asyncHandler(async (_req, res) => {
  const settings = await StoreSettings.getSettings();
  res.json({
    success: true,
    data: {
      storeName: settings.storeName,
      storeDescription: settings.storeDescription,
      logo: settings.logo,
      favicon: settings.favicon,
      contactEmail: settings.contactEmail,
      supportUrl: settings.supportUrl,
      socialLinks: settings.socialLinks,
      seoDefaults: settings.seoDefaults,
      footerText: settings.footerText,
    },
  });
}));

app.get('/api/apps', validateQuery(applicationQuerySchema), asyncHandler(applicationController.listPublicApps.bind(applicationController)));
app.get('/api/apps/:slug', asyncHandler(applicationController.getPublicApp.bind(applicationController)));
app.get('/api/apps/:slug/reviews', asyncHandler(reviewController.publicList.bind(reviewController)));
app.post('/api/apps/:slug/reviews', reviewLimiter, validate(createReviewSchema), asyncHandler(reviewController.create.bind(reviewController)));
app.get('/api/categories', asyncHandler(applicationController.getCategories.bind(applicationController)));
app.get('/api/releases/:releaseId', asyncHandler(releaseController.getPublicRelease.bind(releaseController)));
app.get('/api/downloads/:downloadId', asyncHandler(downloadController.publicDetails.bind(downloadController)));
app.get('/api/downloads/:downloadId/redirect', downloadLimiter, asyncHandler(downloadController.redirect.bind(downloadController)));

app.get('/sitemap.xml', asyncHandler(async (_req, res) => {
  const apps = await Application.find({ status: 'published' }).select('slug updatedAt').lean();
  const base = env.CLIENT_URL.replace(/\/+$/, '');
  const urls = [
    `${base}/`,
    `${base}/software`,
    ...apps.map((item) => `${base}/software/${encodeURIComponent(item.slug)}`),
  ];
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>`
  );
}));
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${env.SERVER_URL}/sitemap.xml\n`);
});

const authRouter = express.Router();
authRouter.post('/login', loginLimiter, validate(loginSchema), asyncHandler(authController.login.bind(authController)));
authRouter.post('/verify-two-factor', loginLimiter, validate(verifyTwoFactorSchema), asyncHandler(authController.verifyTwoFactor.bind(authController)));
authRouter.post('/logout', requireAuth, adminRateLimiter, asyncHandler(authController.logout.bind(authController)));
authRouter.get('/me', requireAuth, adminRateLimiter, asyncHandler(authController.getProfile.bind(authController)));
authRouter.post('/change-password', requireAuth, adminRateLimiter, validate(changePasswordSchema), asyncHandler(authController.changePassword.bind(authController)));
authRouter.post('/email/verification/send', requireAuth, loginLimiter, asyncHandler(authController.sendEmailVerification.bind(authController)));
authRouter.post('/email/verification/confirm', requireAuth, loginLimiter, validate(emailCodeSchema), asyncHandler(authController.verifyEmail.bind(authController)));
authRouter.post('/email/change/request', requireAuth, loginLimiter, asyncHandler(authController.requestEmailChange.bind(authController)));
authRouter.post('/email/change/confirm', requireAuth, loginLimiter, validate(emailCodeSchema), asyncHandler(authController.confirmEmailChange.bind(authController)));
authRouter.post('/two-factor/setup', requireAuth, loginLimiter, asyncHandler(authController.setupTwoFactor.bind(authController)));
authRouter.post('/two-factor/enable', requireAuth, loginLimiter, validate(emailCodeSchema), asyncHandler(authController.enableTwoFactor.bind(authController)));
authRouter.post('/two-factor/disable', requireAuth, loginLimiter, validate(currentPasswordSchema), asyncHandler(authController.disableTwoFactor.bind(authController)));
app.use('/api/admin/auth', authRouter);

const adminRouter = express.Router();
adminRouter.use(requireAuth, adminRateLimiter);
adminRouter.get('/dashboard', asyncHandler(adminController.dashboard.bind(adminController)));
adminRouter.get('/analytics/monthly', asyncHandler(adminController.monthlyAnalytics.bind(adminController)));
adminRouter.get('/applications', asyncHandler(applicationController.adminListApps.bind(applicationController)));
adminRouter.post('/applications/github-preview', asyncHandler(applicationController.githubPreview.bind(applicationController)));
adminRouter.post('/applications', validate(createApplicationSchema), asyncHandler(applicationController.createApp.bind(applicationController)));
adminRouter.get('/applications/:appId', asyncHandler(applicationController.adminGetApp.bind(applicationController)));
adminRouter.put('/applications/:appId', validate(updateApplicationSchema), asyncHandler(applicationController.updateApp.bind(applicationController)));
adminRouter.post('/applications/:appId/images/:kind', imageUpload.single('image'), asyncHandler(applicationController.uploadImage.bind(applicationController)));
adminRouter.delete('/applications/:appId/images', asyncHandler(applicationController.deleteImage.bind(applicationController)));
adminRouter.delete('/applications/:appId', asyncHandler(applicationController.deleteApp.bind(applicationController)));
adminRouter.patch('/applications/:appId/featured', asyncHandler(applicationController.toggleFeatured.bind(applicationController)));
adminRouter.patch('/applications/:appId/pinned', asyncHandler(applicationController.togglePinned.bind(applicationController)));
adminRouter.patch('/applications/:appId/status', asyncHandler(applicationController.changeStatus.bind(applicationController)));

adminRouter.get('/applications/:appId/releases', asyncHandler(releaseController.adminListReleases.bind(releaseController)));
adminRouter.post('/applications/:appId/releases', validate(createReleaseSchema), asyncHandler(releaseController.createRelease.bind(releaseController)));
adminRouter.get('/releases/:releaseId', asyncHandler(releaseController.adminGetRelease.bind(releaseController)));
adminRouter.put('/releases/:releaseId', validate(updateReleaseSchema), asyncHandler(releaseController.updateRelease.bind(releaseController)));
adminRouter.delete('/releases/:releaseId', asyncHandler(releaseController.deleteRelease.bind(releaseController)));
adminRouter.patch('/releases/:releaseId/status', asyncHandler(releaseController.changeStatus.bind(releaseController)));

adminRouter.get('/releases/:releaseId/downloads', asyncHandler(downloadController.listAdmin.bind(downloadController)));
adminRouter.post('/releases/:releaseId/downloads', validate(externalDownloadSchema), asyncHandler(downloadController.createExternal.bind(downloadController)));
adminRouter.post('/releases/:releaseId/uploads', uploadLimiter, validate(uploadInitSchema), asyncHandler(downloadController.initializeUpload.bind(downloadController)));
adminRouter.get('/downloads/:downloadId/parts/:partNumber', uploadLimiter, asyncHandler(downloadController.signPart.bind(downloadController)));
adminRouter.post('/downloads/:downloadId/complete', uploadLimiter, asyncHandler(downloadController.completeUpload.bind(downloadController)));
adminRouter.delete('/downloads/:downloadId/upload', asyncHandler(downloadController.cancelUpload.bind(downloadController)));
adminRouter.patch('/downloads/:downloadId/status', validate(updateDownloadStatusSchema), asyncHandler(downloadController.updateStatus.bind(downloadController)));
adminRouter.delete('/downloads/:downloadId', asyncHandler(downloadController.delete.bind(downloadController)));

adminRouter.get('/settings', asyncHandler(adminController.getSettings.bind(adminController)));
adminRouter.put('/settings', validate(updateSettingsSchema), asyncHandler(adminController.updateSettings.bind(adminController)));
adminRouter.get('/audit-logs', asyncHandler(adminController.auditLogs.bind(adminController)));
adminRouter.get('/reviews', asyncHandler(reviewController.adminList.bind(reviewController)));
adminRouter.patch('/reviews/:reviewId/status', validate(moderateReviewSchema), asyncHandler(reviewController.moderate.bind(reviewController)));
adminRouter.delete('/reviews/:reviewId', asyncHandler(reviewController.delete.bind(reviewController)));
app.use('/api/admin', adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.PORT, async () => {
  try {
    await connectDatabase();
    console.log(`Software store API listening on port ${env.PORT}`);
  } catch (error) {
    console.error('API startup failed because MongoDB is unavailable.');
    server.close(() => process.exit(1));
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void mongoose.disconnect().finally(() => process.exit(0));
    });
  });
}

export { app };
