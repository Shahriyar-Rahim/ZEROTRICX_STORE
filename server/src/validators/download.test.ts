import { describe, expect, it } from 'vitest';
import { externalUrlSchema, isSafePublicUrl } from './download.js';

describe('external installer URLs', () => {
  it('allows public HTTPS links only', () => {
    expect(externalUrlSchema.safeParse('https://downloads.example.org/setup.exe').success).toBe(true);
    expect(isSafePublicUrl('http://downloads.example.org/setup.exe')).toBe(false);
    expect(isSafePublicUrl('javascript:alert(1)')).toBe(false);
  });

  it('blocks local and private network destinations', () => {
    for (const url of [
      'https://localhost/file.exe',
      'https://127.0.0.1/file.exe',
      'https://10.0.0.1/file.exe',
      'https://192.168.1.5/file.exe',
      'https://[::1]/file.exe',
      'https://[::ffff:127.0.0.1]/file.exe',
      'https://user:password@downloads.example.org/file.exe',
    ]) {
      expect(isSafePublicUrl(url), url).toBe(false);
    }
  });
});
