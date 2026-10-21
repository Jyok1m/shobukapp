import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { selfUserSelect, SelfUser } from '../common/self-user';

export const SESSION_COOKIE = 'shobukapp_session';
const DAY_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionService {
  private readonly ttlMs: number;
  private readonly secure: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ttlMs = config.getOrThrow<number>('sessionTtlDays') * DAY_MS;
    this.secure = config.get<string>('appEnv') === 'production';
  }

  async create(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.prisma.session.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    });
    return { token, expiresAt };
  }

  // Sliding expiration: renewed once less than half of the lifetime remains.
  async resolve(
    token: string,
  ): Promise<{ user: SelfUser; renewedUntil: Date | null } | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, expiresAt: true, user: { select: selfUserSelect } },
    });
    if (!session) return null;

    const remaining = session.expiresAt.getTime() - Date.now();
    if (remaining <= 0) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      return null;
    }
    if (remaining < this.ttlMs / 2) {
      const expiresAt = new Date(Date.now() + this.ttlMs);
      await this.prisma.session.update({
        where: { id: session.id },
        data: { expiresAt },
      });
      return { user: session.user, renewedUntil: expiresAt };
    }
    return { user: session.user, renewedUntil: null };
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  async revokeOthers(userId: string, keepToken: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId, tokenHash: { not: hashToken(keepToken) } },
    });
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, {
      ...this.cookieOptions(),
      expires: expiresAt,
    });
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.secure, path: '/' };
  }
}
