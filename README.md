# ZEROTRICX Software Store

A single-owner software storefront built with React, Vite, TypeScript, Express, MongoDB, and Cloudflare R2. Public browsing and downloads do not require a customer account. Only the administrator signs in.

## Local development

Requirements: Node.js 20+, npm, and a MongoDB instance.

1. Copy `.env.example` to `.env`. Set `MONGODB_URI`; generate unique secrets with `openssl rand -base64 48` for `JWT_SECRET` and `SESSION_SECRET`.
2. Install and build:

   ```sh
   npm install
   npm run build
   ```

3. Start the API and Vite frontend:

   ```sh
   npm run dev
   ```

   The site is at `http://localhost:5173`; the API is at `http://localhost:5000`.
4. Provision the first administrator. Do not put the password in shell history; export the variables in your private terminal/session first:

   ```sh
   export ADMIN_USERNAME=owner
   export ADMIN_EMAIL=you@example.com
   export ADMIN_PASSWORD='use-a-unique-14-character-or-longer-password'
   npm run provision-admin
   unset ADMIN_PASSWORD
   ```

   Provisioning refuses duplicate accounts and never creates a default credential.

5. Sign in at `/admin`. Create the application and release, upload platform installers, then publish in order: application, release, and individual download. Uploads remain in the private staging bucket until the last step.

Run the focused checks with `npm test`.

## Product image uploads (Cloudinary)

1. Create or sign in to a Cloudinary account and copy the cloud name, API key, and API secret from its dashboard.
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the root `.env` for local development or in the API host's environment settings for deployment. Keep the API secret server-side; never add it to a `VITE_` variable.
3. In `/admin`, select or create an application. Choose its icon and screenshots from the admin image controls and save/upload. Images are uploaded by the authenticated API, organized under `software-store/apps/<application-id>`, and saved with their Cloudinary public IDs for later replacement/deletion. Icons are limited to 5 MB and screenshots to 10 MB; accepted formats are JPEG, PNG, WebP, and AVIF.
4. Verify the Cloudinary account is active and has available storage/transformations. Image uploads fail explicitly if Cloudinary is not configured or rejects an upload.

## Cloudflare R2 setup (manual)

The bucket, API token, DNS, and custom domain are not configured by this project. Complete these steps in the Cloudflare dashboard:

1. Create two separate R2 buckets: a **private staging** bucket and a **public downloads** bucket. Create an R2 API token limited to these buckets with object read/write/delete, copy, and multipart upload permissions. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (public), `R2_STAGING_BUCKET_NAME` (private), and `R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com` only in the backend environment. Production refuses a missing or identical staging bucket.
2. Attach a download-only custom domain such as `downloads.example.com` to the public bucket only. Do not attach a public domain or enable public access for the staging bucket. Configure DNS and wait for Cloudflare to activate HTTPS. Set `R2_PUBLIC_BASE_URL=https://downloads.example.com`. Objects under generated `apps/<slug>/<version>/<os>-<arch>/<unique-filename>` paths are copied from staging to the public bucket only when an installer is published; disabling it moves the object back to staging.
3. Do not expose R2 credentials in a Vite variable. The website creates short-lived presigned upload URLs for the private staging bucket; the browser never receives permanent keys.
4. Configure bucket CORS on both buckets for the exact website origin only (for local development, `http://localhost:5173`). Set `AllowedMethods` to `PUT`, `AllowedHeaders` to `["*"]`, `ExposeHeaders` to `["ETag"]`, and `MaxAgeSeconds` to `3600`. Do not use `*` for allowed origins in production. The staging bucket must remain private regardless of CORS. If the browser reports that it cannot reach R2, confirm this CORS rule on the **staging** bucket and allow the frontend origin that is shown in the upload error.
5. Uploads up to 100 MiB use a single presigned PUT. Larger files use presigned 10 MiB multipart chunks. After completion, the API checks exact object size and streams the stored object to calculate SHA-256 before marking it verified. R2 must be configured and reachable for this workflow.

Never copy real secrets into `.env.example`, the client environment, source control, screenshots, or support logs.

## Admin email and verification codes

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS` in the root `.env` (or the API host's secret environment). Set `SMTP_FROM` to an email address verified with the SMTP provider; if omitted, `SMTP_USER` is used as the sender. `ADMIN_EMAIL` is for administrative notifications and is not automatically used as the sender when SMTP credentials are set. Restart the API after changing these settings. Email verification and email-based two-factor codes cannot be delivered until SMTP is configured. A rejected message now returns a specific delivery error and logs only the SMTP error code and response code, not the message body or credentials.

## Production deployment

- Host the built `client/dist` assets on a static frontend host with HTTPS. Configure its SPA fallback to serve `index.html` for client-side routes. For SEO crawlers and social previews that do not execute JavaScript, add prerendering or server-side rendering before launch; Vite's client-rendered application alone is not full server-side SEO. Product pages set title, description, Open Graph, and canonical metadata at runtime.
- Host `server/dist` on a Node.js 20+ service. Route `/api/*`, `/health`, `/sitemap.xml`, and `/robots.txt` to the API. Set `CLIENT_URL` to the exact HTTPS frontend origin and `SERVER_URL` to the API origin. Use HTTPS and configure the trusted reverse-proxy count correctly for your host.
- For Render, create a Blueprint from this repository using the root-level `render.yaml`. Keep the service root directory at the repository root so the npm workspaces and lockfile are available; the Blueprint installs development dependencies for the TypeScript build, builds the server workspace, and starts the compiled server. Add the required backend secrets and environment variables from `.env.example` in the Render dashboard.
- Use MongoDB Atlas or another managed MongoDB service. Restrict network access, use a least-privilege database user, enable backups, and test restoration.
- Set `NODE_ENV=production`, secure JWT/session secrets, MongoDB URI, R2 variables, Cloudinary credentials, upload limits, analytics retention, and an optional `COOKIE_DOMAIN`. Avoid `COOKIE_DOMAIN` unless the frontend and API cookie domain design requires it. Cookies are HttpOnly, Secure in production, and SameSite=Strict.
- Configure monitoring for API health, failed storage operations, database errors, and backup status. Run `npm run build`, `npm test`, admin login/logout, a draft-to-publish flow (application → release → installer), a test R2 upload/checksum, and an anonymous public download before announcing the site.

## API overview

Public: `GET /api/apps`, `/api/apps/:slug`, `/api/categories`, `/api/releases/:releaseId`, `/api/downloads/:downloadId`, and `/api/downloads/:downloadId/redirect`.

Administrator endpoints live under `/api/admin`. The login endpoint sets an HttpOnly cookie; the remainder require a valid administrator cookie. `DELETE` operations involving R2 objects require `?confirm=true`. Download analytics count redirect clicks only and do not imply that an installer finished downloading.

The sitemap lists published product URLs. Search/filter/pagination are MongoDB-backed. All published/download-enabled links are resolved server-side; public API responses do not contain R2 write credentials or object keys.
