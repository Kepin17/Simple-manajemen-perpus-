import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ENV, loadEnv } from '../config/env';
import { SignatureGuard } from '../common/signature.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { JwtAuthGuard } from './jwt.guard';
import { OTP_SENDER, OtpService } from './otp.service';
import { UserRepository } from './user.repository';
import { ConsoleOtpSender } from './console-otp.sender';

@Module({
  imports: [
    JwtModule.register({
      global: false,
      secret: loadEnv().jwtSecret,
      signOptions: { algorithm: 'HS256', expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    { provide: OTP_SENDER, useClass: ConsoleOtpSender },
    AuthService,
    UserRepository,
    OtpService,
    CaptchaService,
    SignatureGuard,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
