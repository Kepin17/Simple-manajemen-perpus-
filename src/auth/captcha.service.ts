import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env';

// Cloudflare Turnstile. Test secret "1x0000000000000000000000000000000AA" always passes, for local dev only.
@Injectable()
export class CaptchaService {
  constructor(@Inject(ENV) private env: Env) {}

  async verify(token: string, ip?: string): Promise<void> {
    const body = new URLSearchParams({ secret: this.env.turnstileSecret, response: token });
    if (ip) body.set('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success: boolean };
    if (!data.success) throw new BadRequestException('Captcha verification failed');
  }
}
