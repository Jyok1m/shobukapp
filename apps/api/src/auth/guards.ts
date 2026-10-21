import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { Role } from '../generated/prisma/client';
import type { AuthenticatedRequest } from '../common/request';
import { IS_PUBLIC, ROLES } from './decorators';
import { SESSION_COOKIE, SessionService } from './session.service';

// Registered globally before RolesGuard: the latter reads what this one sets.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE
    ];
    if (!token) throw new UnauthorizedException({ code: 'unauthenticated' });

    const resolved = await this.sessions.resolve(token);
    if (!resolved) {
      this.sessions.clearCookie(ctx.switchToHttp().getResponse<Response>());
      throw new UnauthorizedException({ code: 'unauthenticated' });
    }
    if (resolved.renewedUntil) {
      this.sessions.setCookie(
        ctx.switchToHttp().getResponse<Response>(),
        token,
        resolved.renewedUntil,
      );
    }
    req.user = resolved.user;
    req.sessionToken = token;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;

    const { user } = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user) throw new UnauthorizedException({ code: 'unauthenticated' });
    if (!roles.includes(user.role)) {
      throw new ForbiddenException({ code: 'forbidden' });
    }
    return true;
  }
}
