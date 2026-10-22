import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ENV, type Env } from '../config/env';
import { decrypt, encrypt, hmac } from '../common/crypto';

export interface User {
  id: string;
  emailEnc: string; // email encrypted at rest (AES-256-GCM)
  emailHash: string; // keyed hash used for lookup, so the plaintext email is never stored
  passwordHash: string; // argon2id via Bun.password
  createdAt: Date;
}

// ponytail: in-memory store. Swap for a DB table (unique index on emailHash) before production.
@Injectable()
export class UserRepository {
  private byId = new Map<string, User>();
  private byEmailHash = new Map<string, User>();

  constructor(@Inject(ENV) private env: Env) {}

  private normalize(email: string) {
    return email.trim().toLowerCase();
  }

  findByEmail(email: string): User | undefined {
    return this.byEmailHash.get(hmac(this.normalize(email), this.env.encryptionKey));
  }

  findById(id: string): User | undefined {
    return this.byId.get(id);
  }

  create(email: string, passwordHash: string): User {
    const user: User = {
      id: randomUUID(),
      emailEnc: encrypt(this.normalize(email), this.env.encryptionKey),
      emailHash: hmac(this.normalize(email), this.env.encryptionKey),
      passwordHash,
      createdAt: new Date(),
    };
    this.byId.set(user.id, user);
    this.byEmailHash.set(user.emailHash, user);
    return user;
  }

  emailOf(user: User): string {
    return decrypt(user.emailEnc, this.env.encryptionKey);
  }
}
