export type AdminRateLimitExemptionMode = 'timed' | 'unlimited' | 'disabled';

export function isAdminRateLimitExempt(
  mode: AdminRateLimitExemptionMode,
  minutes: number,
  issuedAt?: number,
  now = Date.now(),
): boolean {
  if (mode === 'unlimited') return true;
  return mode === 'timed'
    && typeof issuedAt === 'number'
    && now < issuedAt * 1000 + minutes * 60 * 1000;
}
