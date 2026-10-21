import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import type { SelfUser } from '../common/self-user';
import {
  CreateCodeInvitationDto,
  CreateJoinRequestDto,
  ListJoinRequestsQuery,
  UpdateJoinRequestDto,
} from './onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller()
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  // Answers the same whatever happened, the honeypot included.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @Post('join-requests')
  @HttpCode(202)
  async createJoinRequest(
    @Body() dto: CreateJoinRequestDto,
  ): Promise<{ received: true }> {
    await this.onboarding.createJoinRequest(dto);
    return { received: true };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('auth/invitations/:token')
  previewInvitation(@Param('token') token: string) {
    return this.onboarding.previewLink(token);
  }
}

@Controller('admin')
@Roles('ADMIN')
export class AdminOnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('join-requests')
  list(@Query() query: ListJoinRequestsQuery) {
    return this.onboarding.listJoinRequests(query);
  }

  @Get('join-requests/count')
  countNew() {
    return this.onboarding.countNew();
  }

  @Get('join-requests/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.onboarding.joinRequest(id);
  }

  @Patch('join-requests/:id')
  update(
    @CurrentUser() admin: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJoinRequestDto,
  ) {
    return this.onboarding.setJoinRequestStatus(admin, id, dto.status);
  }

  @Delete('join-requests/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.onboarding.deleteJoinRequest(id);
  }

  @Post('join-requests/:id/invite')
  invite(
    @CurrentUser() admin: SelfUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.onboarding.inviteFromJoinRequest(admin, id);
  }

  @Get('invitations')
  invitations() {
    return this.onboarding.listInvitations();
  }

  @Post('invitations')
  createCode(
    @CurrentUser() admin: SelfUser,
    @Body() dto: CreateCodeInvitationDto,
  ) {
    return this.onboarding.createCodeInvitation(admin, dto);
  }

  @Delete('invitations/:id')
  @HttpCode(204)
  revoke(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.onboarding.revokeInvitation(id);
  }
}
