import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from './subscriptions.service';

/*
 * The only source of entitlement (docs/billing.md, Webhook). Handlers are
 * upserts, so replaying an event is harmless; stripe_events records an event
 * only once it was processed, so a failure lets Stripe retry it.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async handle(rawBody: Buffer | undefined, signature: string | undefined) {
    const stripe = this.stripe.require();
    if (!this.stripe.webhookSecret) {
      throw new ServiceUnavailableException({ code: 'webhook_disabled' });
    }
    if (!rawBody || !signature) {
      throw new BadRequestException({ code: 'invalid_signature' });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.stripe.webhookSecret,
      );
    } catch {
      throw new BadRequestException({ code: 'invalid_signature' });
    }

    const seen = await this.prisma.stripeEvent.findUnique({
      where: { id: event.id },
    });
    if (seen) return;

    await this.dispatch(event);

    try {
      await this.prisma.stripeEvent.create({
        data: { id: event.id, type: event.type },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
    }
  }

  private async dispatch(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const subscription = event.data.object.subscription;
        if (subscription) {
          await this.subscriptions.syncFromStripe(
            typeof subscription === 'string' ? subscription : subscription.id,
          );
        }
        return;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.subscriptions.syncFromStripe(event.data.object.id);
        return;
      case 'invoice.paid':
        await this.subscriptions.recordInvoice(event.data.object, 'PAID');
        return;
      case 'invoice.payment_failed':
        // Cuts nothing: Stripe retries, subscription.deleted ends access.
        await this.subscriptions.recordInvoice(event.data.object, 'FAILED');
        return;
      default:
        this.logger.debug(`Ignored Stripe event ${event.type}`);
    }
  }
}
