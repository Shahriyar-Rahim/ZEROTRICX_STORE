import { describe, expect, it } from 'vitest';
import { isAdminRateLimitExempt } from './rateLimitExemption.js';

describe('admin rate-limit exemption policy', () => {
  const issuedAt = 1_000;
  const oneHour = 60;

  it('exempts requests before the configured login window expires', () => {
    expect(isAdminRateLimitExempt('timed', oneHour, issuedAt, 4_599_999)).toBe(true);
  });

  it('ends the timed exemption exactly at its expiry', () => {
    expect(isAdminRateLimitExempt('timed', oneHour, issuedAt, 4_600_000)).toBe(false);
  });

  it('keeps the exemption disabled without a login timestamp', () => {
    expect(isAdminRateLimitExempt('timed', oneHour, undefined)).toBe(false);
    expect(isAdminRateLimitExempt('disabled', oneHour, issuedAt)).toBe(false);
  });

  it('keeps unlimited mode exempt regardless of the login timestamp', () => {
    expect(isAdminRateLimitExempt('unlimited', oneHour, undefined)).toBe(true);
  });
});
