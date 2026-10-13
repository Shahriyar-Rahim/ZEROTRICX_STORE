import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { checksumService } from './checksumService.js';

describe('checksumService', () => {
  it('calculates SHA-256 from a stream without buffering the input', async () => {
    const checksum = await checksumService.calculateSha256FromStream(Readable.from(['soft', 'ware store']));
    expect(checksum).toBe('a70b1faa6c5d5771a4935ed114cafcb8d6e0df7cafe43eed81c0843b8b197237');
  });

  it('compares valid checksums without case sensitivity', () => {
    const checksum = checksumService.calculateSha256FromBuffer(Buffer.from('abc'));
    expect(checksumService.verifyChecksum(checksum.toUpperCase(), checksum)).toBe(true);
    expect(checksumService.verifyChecksum('bad', checksum)).toBe(false);
  });
});
