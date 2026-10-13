export const API = import.meta.env.VITE_API_URL || '';

export interface Download {
  _id: string;
  os: 'windows' | 'linux' | 'macos';
  architecture: string;
  format: string;
  fileName: string;
  fileSize: number;
  sha256Checksum?: string;
  checksumVerified?: boolean;
  status: string;
  storageProvider: 'r2' | 'external';
  downloadCount?: number;
}

export interface Release {
  _id: string;
  version: string;
  releaseDate: string;
  changelog?: string;
  releaseType: string;
  status: string;
  minimumRequirements?: Record<string, string>;
  downloads?: Download[];
}

export interface AppProduct {
  _id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  icon?: { url: string; key?: string };
  screenshots?: { key: string; url: string; caption?: string; order?: number }[];
  category: string;
  features?: string[];
  supportedPlatforms?: { os: string; architectures: string[]; minRequirements?: string }[];
  status?: string;
  isFeatured?: boolean;
  isPinned?: boolean;
  githubUrl?: string;
  websiteUrl?: string;
  currentVersion?: string;
  totalDownloads?: number;
  ratingAverage?: number;
  reviewCount?: number;
  license?: string;
  supportUrl?: string;
  privacyPolicyUrl?: string;
  seoDescription?: string;
  seoTitle?: string;
  installationInstructions?: Record<string, string>;
  releases?: Release[];
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const response = await fetch(`${API}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Request failed (${response.status})`);
  }
  return payload as T;
}

export function formatBytes(bytes = 0): string {
  if (!bytes) return 'Size unavailable';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function titleCase(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
