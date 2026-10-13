import crypto from 'crypto';
import { Readable } from 'stream';

export class ChecksumService {
  /**
   * Calculate SHA-256 without loading the entire file into memory
   */
  async calculateSha256FromStream(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex').toLowerCase());
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Calculate SHA-256 from a Buffer
   */
  calculateSha256FromBuffer(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();
  }

  /**
   * Verify checksum using timingSafeEqual to avoid timing attacks
   */
  verifyChecksum(expected: string, actual: string): boolean {
    const cleanExpected = expected.trim().toLowerCase();
    const cleanActual = actual.trim().toLowerCase();

    if (cleanExpected.length !== cleanActual.length) {
      return false;
    }

    try {
      const bufA = Buffer.from(cleanExpected, 'hex');
      const bufB = Buffer.from(cleanActual, 'hex');
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return cleanExpected === cleanActual;
    }
  }
}

export const checksumService = new ChecksumService();
