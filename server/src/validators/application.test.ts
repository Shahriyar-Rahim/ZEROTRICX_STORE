import { describe, expect, it } from 'vitest';
import { applicationQuerySchema } from './application.js';

describe('application query validation', () => {
  it('accepts empty optional catalog filters as unfiltered values', () => {
    expect(applicationQuerySchema.parse({
      search: '',
      category: '',
      os: '',
      sort: 'updated',
      page: '1',
      limit: '12',
    })).toMatchObject({ search: undefined, category: undefined, os: undefined, sort: 'updated', page: 1, limit: 12 });
  });

  it('continues to reject unsupported platform filters', () => {
    expect(() => applicationQuerySchema.parse({ os: 'android' })).toThrow();
  });
});
