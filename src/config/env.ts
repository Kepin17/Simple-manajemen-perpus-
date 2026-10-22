export const ENV = Symbol('ENV');

export const DEFAULT_LATE_FEE_PER_DAY = 1000; // rupiah

export interface Env {
  jwtSecret: string;
  encryptionKey: Buffer;
  signingSecret: string;
  turnstileSecret: string;
  databaseUrl: string;
  lateFeePerDay: number;
  otpEnabled: boolean;
}

// Fail fast at boot: a missing secret must never fall back to a default.
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const required = ['JWT_SECRET', 'ENCRYPTION_KEY', 'SIGNING_SECRET', 'TURNSTILE_SECRET_KEY', 'DATABASE_URL'];
  const missing = required.filter((k) => !source[k]);
  if (missing.length) throw new Error(`Missing env: ${missing.join(', ')}`);

  const jwtSecret = source.JWT_SECRET!;
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');

  const encryptionKey = Buffer.from(source.ENCRYPTION_KEY!, 'base64');
  if (encryptionKey.length !== 32) throw new Error('ENCRYPTION_KEY must be base64 of 32 bytes');

  // Optional: empty or unset means the default, so a missing value never blocks boot.
  const lateFeeRaw = source.LATE_FEE_PER_DAY?.trim();
  const lateFeePerDay = lateFeeRaw ? Number(lateFeeRaw) : DEFAULT_LATE_FEE_PER_DAY;
  if (!Number.isSafeInteger(lateFeePerDay) || lateFeePerDay < 0) {
    throw new Error('LATE_FEE_PER_DAY must be a non-negative integer');
  }

  // OTP_ENABLED=false: login langsung memberi JWT tanpa langkah OTP. Default true.
  const otpEnabled = source.OTP_ENABLED?.trim().toLowerCase() !== 'false';

  return {
    jwtSecret,
    encryptionKey,
    signingSecret: source.SIGNING_SECRET!,
    turnstileSecret: source.TURNSTILE_SECRET_KEY!,
    databaseUrl: source.DATABASE_URL!,
    lateFeePerDay,
    otpEnabled,
  };
}
