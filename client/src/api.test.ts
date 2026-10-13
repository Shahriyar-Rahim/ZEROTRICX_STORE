import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, formatBytes, titleCase } from './api';

describe('store display helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('formats file sizes clearly', () => {
    expect(formatBytes(0)).toBe('Size unavailable');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1_073_741_824)).toBe('1.0 GB');
  });

  it('makes platform names readable', () => {
    expect(titleCase('macos')).toBe('Macos');
    expect(titleCase('tar.gz')).toBe('Tar.Gz');
  });

  it('lets the browser set multipart headers for image uploads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} })));
    vi.stubGlobal('fetch', fetchMock);
    const body = new FormData();
    body.append('image', new Blob(['image bytes'], { type: 'image/png' }), 'icon.png');

    await api('/admin/applications/app-id/images/icon', { method: 'POST', body });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.headers).not.toHaveProperty('Content-Type');
    expect(request.credentials).toBe('include');
  });
});
