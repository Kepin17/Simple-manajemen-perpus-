import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { decrypt, encrypt, safeEqual } from '../common/crypto';
import { signRequest } from '../common/signature.guard';
import type { Env } from '../config/env';
import { OtpService } from './otp.service';

const env = {
  jwtSecret: 'x'.repeat(32),
  encryptionKey: randomBytes(32),
  signingSecret: 'signing-secret-for-tests',
  turnstileSecret: 'unused',
} as Env;

describe('crypto', () => {
  it('encrypt/decrypt roundtrip', () => {
    const payload = encrypt('user@example.com', env.encryptionKey);
    expect(payload).not.toContain('user@example.com');
    expect(decrypt(payload, env.encryptionKey)).toBe('user@example.com');
  });

  it('rejects tampered ciphertext', () => {
    const [iv, tag, data] = encrypt('secret', env.encryptionKey).split('.');
    const tampered = [iv, tag, data!.slice(0, -2) + 'AA'].join('.');
    expect(() => decrypt(tampered, env.encryptionKey)).toThrow();
  });

  it('safeEqual compares strictly', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('request signature', () => {
  const base = { method: 'post', path: '/auth/login', timestamp: '1700000000000', nonce: 'n1', rawBody: '{"a":1}' };

  it('is deterministic and binds body and path', () => {
    const sig = signRequest(base, env.signingSecret);
    expect(signRequest(base, env.signingSecret)).toBe(sig);
    expect(signRequest({ ...base, rawBody: '{"a":2}' }, env.signingSecret)).not.toBe(sig);
    expect(signRequest({ ...base, path: '/auth/register' }, env.signingSecret)).not.toBe(sig);
  });
});

describe('OtpService', () => {
  it('accepts the right code once', () => {
    const otp = new OtpService(env);
    const { challengeId, code } = otp.issue('user-1');
    expect(otp.verify(challengeId, code)).toBe('user-1');
    expect(otp.verify(challengeId, code)).toBeNull(); // single use
  });

  it('locks the challenge after 5 wrong attempts, even with the right code', () => {
    const otp = new OtpService(env);
    const { challengeId, code } = otp.issue('user-1');
    for (let i = 0; i < 5; i++) {
      const bad = code === '000000' ? '111111' : '000000';
      expect(otp.verify(challengeId, bad)).toBeNull();
    }
    expect(otp.verify(challengeId, code)).toBeNull();
  });
});
