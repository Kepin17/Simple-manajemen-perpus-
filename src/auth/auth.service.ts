import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CaptchaService } from './captcha.service';
import { OTP_SENDER, type OtpSender, OtpService } from './otp.service';
import { UserRepository } from './user.repository';
import { ENV, type Env } from '../config/env';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  // Hashed once up front, so a login for an unknown email costs the same time as a real one.
  private dummyHash = Bun.password.hash('timing-equalizer-password');

  constructor(
    private users: UserRepository,
    private otp: OtpService,
    private captcha: CaptchaService,
    private jwt: JwtService,
    @Inject(OTP_SENDER) private sender: OtpSender,
    @Inject(ENV) private env: Env,
  ) {}

  async register(email: string, password: string, captchaToken: string, ip?: string) {
    await this.captcha.verify(captchaToken, ip);
    if (this.users.findByEmail(email)) throw new ConflictException('Email already registered');

    const user = this.users.create(email, await Bun.password.hash(password));
    return { id: user.id };
  }

  async login(email: string, password: string, captchaToken: string, ip?: string) {
    await this.captcha.verify(captchaToken, ip);

    const user = this.users.findByEmail(email);
    const valid = await Bun.password.verify(password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !valid) throw new UnauthorizedException('Invalid credentials');

    if (!this.env.otpEnabled) return this.issueToken(user.id);

    const { challengeId, code } = this.otp.issue(user.id);
    await this.sender.send(this.users.emailOf(user), code);
    return { challengeId };
  }

  private async issueToken(userId: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId });
    return { accessToken, tokenType: 'Bearer', expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  async verifyOtp(challengeId: string, code: string) {
    const userId = this.otp.verify(challengeId, code);
    if (!userId) throw new UnauthorizedException('Invalid or expired code');

    return this.issueToken(userId);
  }

  me(userId: string) {
    const user = this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: this.users.emailOf(user), createdAt: user.createdAt };
  }
}
