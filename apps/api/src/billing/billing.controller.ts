import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import type { SelfUser } from '../common/self-user';
import {
  CheckoutDto,
  CreatePlanDto,
  FrequencyDto,
  StripeModeDto,
  UpdatePlanDto,
} from './dto/plan.dto';
import { StripeService } from './stripe.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPlan, PlansService, PublicPlan } from './plans.service';
import { MembershipView, SubscriptionsService } from './subscriptions.service';
import { WebhookService } from './webhook.service';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly plans: PlansService,
    private readonly subscriptions: SubscriptionsService,
    private readonly webhook: WebhookService,
  ) {}

  // Members only: the price grid is not shown to visitors.
  @Get('plans')
  listPlans(): Promise<PublicPlan[]> {
    return this.plans.listPublic();
  }

  @Get('subscription')
  membership(@CurrentUser() user: SelfUser): Promise<MembershipView> {
    return this.subscriptions.membership(user.id);
  }

  @Post('checkout')
  @HttpCode(200)
  checkout(
    @CurrentUser() user: SelfUser,
    @Body() dto: CheckoutDto,
  ): Promise<{ url: string }> {
    return this.subscriptions.checkout(user, dto.planId, dto.frequency);
  }

  @Post('subscription/frequency/preview')
  @HttpCode(200)
  previewFrequency(@CurrentUser() user: SelfUser, @Body() dto: FrequencyDto) {
    return this.subscriptions.previewFrequencyChange(user, dto.frequency);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('subscription/frequency')
  @HttpCode(200)
  changeFrequency(@CurrentUser() user: SelfUser, @Body() dto: FrequencyDto) {
    return this.subscriptions.changeFrequency(user, dto.frequency);
  }

  @Post('portal')
  @HttpCode(200)
  portal(@CurrentUser() user: SelfUser): Promise<{ url: string }> {
    return this.subscriptions.portal(user.id);
  }

  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    await this.webhook.handle(req.rawBody, signature);
    return { received: true };
  }
}

@Controller('admin/plans')
@Roles('ADMIN')
export class AdminPlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  list(): Promise<AdminPlan[]> {
    return this.plans.listAll();
  }

  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.plans.update(id, dto);
  }

  @Delete(':id')
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.archive(id);
  }
}

@Controller('admin/settings/billing')
@Roles('ADMIN')
export class AdminBillingSettingsController {
  constructor(
    private readonly stripe: StripeService,
    private readonly plans: PlansService,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Get()
  async get() {
    const settings = await this.prisma.appSettings.findUniqueOrThrow({
      where: { id: 1 },
      select: {
        stripeLive: true,
        updatedAt: true,
        updatedBy: { select: { firstName: true, lastName: true } },
      },
    });
    return {
      mode: settings.stripeLive ? 'live' : 'test',
      configured: {
        test: this.stripe.configured('test'),
        live: this.stripe.configured('live'),
      },
      updatedAt: settings.updatedAt,
      updatedBy: settings.updatedBy,
    };
  }

  /*
   * Plans are brought up to date in the target mode before the switch: if
   * Stripe refuses, the mode does not change and nothing is half sold.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Put()
  async set(@CurrentUser() admin: SelfUser, @Body() dto: StripeModeDto) {
    await this.auth.confirmPassword(admin.id, dto.password);
    if (!this.stripe.configured(dto.mode)) {
      throw new ConflictException({ code: 'stripe_mode_unavailable' });
    }
    const previous = await this.stripe.mode();
    await this.plans.syncAllForMode(dto.mode);
    await this.stripe.setMode(dto.mode, admin.id);
    const notified =
      previous === 'test' && dto.mode === 'live'
        ? await this.subscriptions.notifyTestCotisationsEnded()
        : 0;
    return { ...(await this.get()), notified };
  }
}
