import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';
import { SESSION_COOKIE } from '../auth/session.service';

/*
 * Every browser request reaches the API through the Next rewrite, which does
 * not set X-Forwarded-For: req.ip is always the web server, and trusting a
 * forwarded header would let a client pick its own IP. So the bucket is keyed
 * on what the request is about (docs/auth.md, client IP behind the web proxy).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const body = req.body as { email?: unknown } | undefined;
    if (typeof body?.email === 'string') {
      return Promise.resolve(`email:${body.email.trim().toLowerCase()}`);
    }
    const token = (req.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE
    ];
    if (token) {
      return Promise.resolve(
        `session:${createHash('sha256').update(token).digest('hex')}`,
      );
    }
    return Promise.resolve(`ip:${String(req.ip)}`);
  }
}
