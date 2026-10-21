import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { StripeKeys } from '../../config/configuration';
import { PrismaService } from '../prisma/prisma.service';

export type StripeMode = 'test' | 'live';
export const STRIPE_MODES: StripeMode[] = ['test', 'live'];

// Column names per mode: test and live objects never cross.
export const MODE_FIELDS = {
  test: {
    product: 'stripeTestProductId',
    price: 'stripeTestPriceId',
    customer: 'stripeTestCustomerId',
  },
  live: {
    product: 'stripeLiveProductId',
    price: 'stripeLivePriceId',
    customer: 'stripeLiveCustomerId',
  },
  // product: on plans; price: on plan_prices; customer: on users.
} as const;

/*
 * Billing is optional: without the current mode's key, billing routes answer
 * 503 and the rest of the app keeps working. The current mode lives in the
 * database (app_settings) and is switched by an admin (docs/billing.md).
 */
@Injectable()
export class StripeService {
  private readonly clients: Record<StripeMode, Stripe | null>;
  private readonly webhookSecrets: Record<StripeMode, string | null>;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const keys = config.getOrThrow<Record<StripeMode, StripeKeys>>('stripe');
    this.clients = {
      test: keys.test.secretKey ? new Stripe(keys.test.secretKey) : null,
      live: keys.live.secretKey ? new Stripe(keys.live.secretKey) : null,
    };
    this.webhookSecrets = {
      test: keys.test.webhookSecret,
      live: keys.live.webhookSecret,
    };
  }

  configured(mode: StripeMode): boolean {
    return this.clients[mode] !== null;
  }

  client(mode: StripeMode): Stripe | null {
    return this.clients[mode];
  }

  require(mode: StripeMode): Stripe {
    const client = this.clients[mode];
    if (!client) {
      throw new ServiceUnavailableException({ code: 'billing_disabled' });
    }
    return client;
  }

  webhookSecret(mode: StripeMode): string | null {
    return this.webhookSecrets[mode];
  }

  async mode(): Promise<StripeMode> {
    const settings = await this.prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { stripeLive: true },
    });
    return settings?.stripeLive ? 'live' : 'test';
  }

  async current(): Promise<{ mode: StripeMode; client: Stripe | null }> {
    const mode = await this.mode();
    return { mode, client: this.clients[mode] };
  }

  async requireCurrent(): Promise<{ mode: StripeMode; client: Stripe }> {
    const mode = await this.mode();
    return { mode, client: this.require(mode) };
  }

  async setMode(mode: StripeMode, adminId: string): Promise<void> {
    if (!this.configured(mode)) {
      throw new ConflictException({ code: 'stripe_mode_unavailable' });
    }
    await this.prisma.appSettings.update({
      where: { id: 1 },
      data: { stripeLive: mode === 'live', updatedById: adminId },
    });
  }
}
