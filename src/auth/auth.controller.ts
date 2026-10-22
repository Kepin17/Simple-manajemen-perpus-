import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SignatureGuard } from '../common/signature.guard';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, VerifyOtpDto } from './auth.dto';
import { JwtAuthGuard } from './jwt.guard';

// Public auth routes require a signed request: X-Timestamp, X-Nonce, X-Signature.
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  @UseGuards(SignatureGuard)
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto.email, dto.password, dto.captchaToken, req.ip);
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(SignatureGuard)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.password, dto.captchaToken, req.ip);
  }

  @Post('otp/verify')
  @HttpCode(200)
  @UseGuards(SignatureGuard)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.challengeId, dto.code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: { sub: string } }) {
    return this.auth.me(req.user.sub);
  }
}
