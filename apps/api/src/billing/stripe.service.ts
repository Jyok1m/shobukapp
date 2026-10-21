import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

// Billing is optional: without a key the rest of the app keeps working
// (docs/billing.md, Environments).
@Injectable()
export class StripeService {
  readonly client: Stripe | null;
  readonly webhookSecret: string | null;

  constructor(config: ConfigService) {
    const secretKey = config.get<string | null>('stripe.secretKey');
    this.client = secretKey ? new Stripe(secretKey) : null;
    this.webhookSecret =
      config.get<string | null>('stripe.webhookSecret') ?? null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  require(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException({ code: 'billing_disabled' });
    }
    return this.client;
  }
}
