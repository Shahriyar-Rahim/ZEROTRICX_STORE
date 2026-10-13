import { z } from 'zod';
import { isIP } from 'node:net';

export function isSafePublicUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') {
      return false;
    }

    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (isIP(host)) {
      if (host.includes(':')) {
        return !(host === '::' || host === '::1' || host.startsWith('::ffff:') ||
          host.startsWith('fc') || host.startsWith('fd') || /^fe[89ab]/.test(host) ||
          host.startsWith('ff'));
      }
      const [a, b] = host.split('.').map(Number);
      const [c] = host.split('.').slice(2).map(Number);
      return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) ||
        (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
        (a === 203 && b === 0 && c === 113));
    }

    // Prevent localhost / private loopback
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }

    // Prevent private IP ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = host.match(ipv4Regex);
    if (ipMatch) {
      const octet1 = parseInt(ipMatch[1], 10);
      const octet2 = parseInt(ipMatch[2], 10);

      // 10.0.0.0/8
      if (octet1 === 10) return false;
      // 172.16.0.0/12
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return false;
      // 192.168.0.0/16
      if (octet1 === 192 && octet2 === 168) return false;
      // 169.254.0.0/16 (link local / AWS metadata)
      if (octet1 === 169 && octet2 === 254) return false;
      // 127.0.0.0/8
      if (octet1 === 127) return false;
      // 0.0.0.0/8
      if (octet1 === 0) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const externalUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(isSafePublicUrl, 'URL points to an invalid or disallowed internal host');

export const createDownloadSchema = z.object({
  os: z.enum(['windows', 'linux', 'macos']),
  architecture: z.enum(['x64', 'arm64', 'universal']),
  format: z.enum(['exe', 'msi', 'zip', 'deb', 'appimage', 'rpm', 'dmg', 'pkg', 'tar.gz']),
  storageProvider: z.enum(['r2', 'external']).default('r2'),
  fileName: z.string().min(1, 'File name is required').trim(),
  fileSize: z.number().nonnegative().optional().default(0),
  sha256Checksum: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Must be a valid 64-character hex SHA-256 hash').optional(),
  mimeType: z.string().optional(),
  externalUrl: externalUrlSchema.optional(),
  r2Key: z.string().optional(),
  status: z.enum(['pending', 'uploading', 'uploaded', 'published', 'disabled', 'failed']).default('pending'),
});

export const updateDownloadSchema = createDownloadSchema.partial();

export const initiateUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required').trim(),
  fileSize: z.number().positive('File size must be greater than zero'),
  mimeType: z.string().default('application/octet-stream'),
  os: z.enum(['windows', 'linux', 'macos']),
  architecture: z.enum(['x64', 'arm64', 'universal']),
  format: z.enum(['exe', 'msi', 'zip', 'deb', 'appimage', 'rpm', 'dmg', 'pkg', 'tar.gz']),
  isMultipart: z.boolean().default(false),
  sha256Checksum: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Must be a 64-character hex SHA-256 hash').optional(),
});

export const completeUploadSchema = z.object({
  uploadId: z.string().optional(),
  parts: z
    .array(
      z.object({
        PartNumber: z.number().int().positive(),
        ETag: z.string().min(1),
      })
    )
    .optional(),
  sha256Checksum: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Must be a 64-character hex SHA-256 hash').optional(),
  actualSize: z.number().positive().optional(),
});

export const uploadInitSchema = z.object({
  fileName: z.string().min(1).max(240).refine((value) => !/[\\/]/.test(value), 'Use a file name without path segments'),
  fileSize: z.number().positive(),
  os: z.enum(['windows', 'linux', 'macos']),
  architecture: z.enum(['x64', 'arm64', 'universal']),
  format: z.enum(['exe', 'msi', 'zip', 'deb', 'appimage', 'rpm', 'dmg', 'pkg', 'tar.gz']),
});

export const externalDownloadSchema = createDownloadSchema.extend({
  storageProvider: z.literal('external'),
  externalUrl: externalUrlSchema,
}).omit({ r2Key: true }).refine((value) => value.status === 'published' || value.status === 'disabled' || value.status === 'pending', {
  message: 'External download status must be pending, published, or disabled',
});

export const updateDownloadStatusSchema = z.object({
  status: z.enum(['published', 'disabled']),
});

export type CreateDownloadInput = z.infer<typeof createDownloadSchema>;
export type UpdateDownloadInput = z.infer<typeof updateDownloadSchema>;
export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
