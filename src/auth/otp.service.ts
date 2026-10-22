import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ENV, type Env } from '../config/env';
import { hmac, randomOtp, safeEqual } from '../common/crypto';

const TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

interface Challenge {
  userId: string;
  codeHash: string; // HMAC of the code, the plain code is never stored
  expiresAt: number;
  attempts: number;
}

export interface OtpSender {
  send(to: string, code: string): Promise<void>;
}

export const OTP_SENDER = Symbol('OTP_SENDER');

// ponytail: in-memory challenges. Move to Redis with TTL when running more than one instance.
@Injectable()
export class OtpService {
  private challenges = new Map<string, Challenge>();

  constructor(@Inject(ENV) private env: Env) {}

  issue(userId: string): { challengeId: string; code: string } {
    this.sweep();
    const challengeId = randomBytes(16).toString('base64url');
    const code = randomOtp();
    this.challenges.set(challengeId, {
      userId,
      codeHash: hmac(code, this.env.signingSecret),
      expiresAt: Date.now() + TTL_MS,
      attempts: 0,
    });
    return { challengeId, code };
  }

  // Returns the userId on success. Every failure returns null, so callers can't tell the reason apart.
  verify(challengeId: string, code: string): string | null {
    const ch = this.challenges.get(challengeId);
    if (!ch) return null;
    if (ch.expiresAt < Date.now() || ch.attempts >= MAX_ATTEMPTS) {
      this.challenges.delete(challengeId);
      return null;
    }

    ch.attempts += 1;
    if (!safeEqual(hmac(code, this.env.signingSecret), ch.codeHash)) return null;

    this.challenges.delete(challengeId); // single use
    return ch.userId;
  }

  private sweep() {
    const now = Date.now();
    for (const [id, ch] of this.challenges) {
      if (ch.expiresAt < now) this.challenges.delete(id);
    }
  }
}
