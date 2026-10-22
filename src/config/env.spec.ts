import { describe, expect, it } from 'bun:test';
import { loadEnv } from './env';

const base = {
  JWT_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  SIGNING_SECRET: 'signing',
  TURNSTILE_SECRET_KEY: 'turnstile',
  DATABASE_URL: 'postgres://localhost/test',
};

describe('LATE_FEE_PER_DAY', () => {
  it('defaults to 1000 when unset or empty', () => {
    expect(loadEnv(base).lateFeePerDay).toBe(1000);
    expect(loadEnv({ ...base, LATE_FEE_PER_DAY: '' }).lateFeePerDay).toBe(1000);
  });

  it('reads the configured rate', () => {
    expect(loadEnv({ ...base, LATE_FEE_PER_DAY: '2500' }).lateFeePerDay).toBe(2500);
  });

  it('rejects a value that is not a non-negative integer', () => {
    expect(() => loadEnv({ ...base, LATE_FEE_PER_DAY: 'abc' })).toThrow('LATE_FEE_PER_DAY');
    expect(() => loadEnv({ ...base, LATE_FEE_PER_DAY: '-1' })).toThrow('LATE_FEE_PER_DAY');
  });
});
