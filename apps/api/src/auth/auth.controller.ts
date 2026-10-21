import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../common/request';
import type { SelfUser } from '../common/self-user';
import { AuthService } from './auth.service';
import { AllowPendingPassword, CurrentUser, Public } from './decorators';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { SESSION_COOKIE, SessionService } from './session.service';

function incomingToken(req: AuthenticatedRequest): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
}

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  async register(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SelfUser> {
    const user = await this.auth.register(dto);
    await this.openSession(req, user.id, res);
    return user;
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(200)
  async login(
    @Req() req: AuthenticatedRequest,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SelfUser> {
    const user = await this.auth.login(dto);
    await this.openSession(req, user.id, res);
    return user;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = incomingToken(req);
    if (token) await this.sessions.revoke(token);
    this.sessions.clearCookie(res);
  }

  @AllowPendingPassword()
  @Get('me')
  me(@CurrentUser() user: SelfUser): SelfUser {
    return user;
  }

  @AllowPendingPassword()
  @Throttle(AUTH_THROTTLE)
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changePassword(req.user.id, dto);
    await this.sessions.revokeOthers(req.user.id, req.sessionToken);
  }

  // The session the request arrived with is replaced, not left alive.
  private async openSession(
    req: AuthenticatedRequest,
    userId: string,
    res: Response,
  ): Promise<void> {
    const previous = incomingToken(req);
    if (previous) await this.sessions.revoke(previous);
    const { token, expiresAt } = await this.sessions.create(userId);
    this.sessions.setCookie(res, token, expiresAt);
  }
}
