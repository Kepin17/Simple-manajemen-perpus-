import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ENV, type Env } from '../config/env';
import { hmac, safeEqual } from './crypto';

const WINDOW_MS = 60_000; // timestamp must be within ±60s
const NONCE_TTL_MS = 120_000; // nonces are remembered slightly longer than the window

export interface SignedRequest {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  rawBody: string;
}

export function signRequest(req: SignedRequest, secret: string): string {
  const bodyHash = createHash('sha256').update(req.rawBody).digest('hex');
  const canonical = [req.method.toUpperCase(), req.path, req.timestamp, req.nonce, bodyHash].join('\n');
  return hmac(canonical, secret);
}

// Client sends X-Timestamp, X-Nonce, X-Signature. Nonces are single-use, which blocks replays.
// ponytail: nonce store is in-memory, per instance. Move to Redis when running more than one instance.
@Injectable()
export class SignatureGuard implements CanActivate {
  private seenNonces = new Map<string, number>();
  private lastSweep = 0;

  constructor(@Inject(ENV) private env: Env) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const timestamp = req.headers['x-timestamp'];
    const nonce = req.headers['x-nonce'];
    const signature = req.headers['x-signature'];
    if (typeof timestamp !== 'string' || typeof nonce !== 'string' || typeof signature !== 'string') {
      throw new UnauthorizedException();
    }
    if (nonce.length > 128) throw new UnauthorizedException();

    const now = Date.now();
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > WINDOW_MS) throw new UnauthorizedException();

    this.sweep(now);
    if (this.seenNonces.has(nonce)) throw new UnauthorizedException();

    const expected = signRequest(
      { method: req.method, path: req.path, timestamp, nonce, rawBody: req.rawBody ?? '' },
      this.env.signingSecret,
    );
    if (!safeEqual(expected, signature)) throw new UnauthorizedException();

    this.seenNonces.set(nonce, now + NONCE_TTL_MS);
    return true;
  }

  private sweep(now: number) {
    if (now - this.lastSweep < 10_000) return;
    this.lastSweep = now;
    for (const [nonce, expiresAt] of this.seenNonces) {
      if (expiresAt < now) this.seenNonces.delete(nonce);
    }
  }
}
