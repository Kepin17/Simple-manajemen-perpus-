import { Injectable, Logger } from '@nestjs/common';
import type { OtpSender } from './otp.service';

// Dev only: prints the code to the console. Replace with an email/SMS provider before production.
@Injectable()
export class ConsoleOtpSender implements OtpSender {
  private logger = new Logger('OTP');

  async send(to: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ConsoleOtpSender must not be used in production');
    }
    this.logger.log(`OTP for ${to}: ${code}`);
  }
}
