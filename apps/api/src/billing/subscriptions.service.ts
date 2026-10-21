import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import type { SelfUser } from '../common/self-user';
import { StripeService } from './stripe.service';

import { createHash } from 'node:crypto';

export const ACTIVE_STATUSES = ['active', 'trialing'];
export const LATE_STATUSES = ['past_due', 'unpaid'];
/*
 * past_due keeps the membership: Stripe is still retrying, and only
 * customer.subscription.deleted ends access (docs/billing.md, Webhook).
 */
export const MEMBER_STATUSES = [...ACTIVE_STATUSES, 'past_due'];
// A subscription in one of these blocks a second checkout.
const BLOCKING_STATUSES = [...ACTIVE_STATUSES, ...LATE_STATUSES, 'incomplete'];

type SubscriptionLike = { status: string; createdAt: Date };

/*
 * The subscription that describes a member: a live one first, else the most
 * recently created. Never by updated_at, which a replayed event on an old
 * subscription bumps.
 */
export function pickCurrent<T extends SubscriptionLike>(subs: T[]): T | null {
  const byCreation = [...subs].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return (
    byCreation.find((s) => MEMBER_STATUSES.includes(s.status)) ??
    byCreation.find((s) => LATE_STATUSES.includes(s.status)) ??
    byCreation[0] ??
    null
  );
}

export type MembershipView = {
  status: string | null;
  isMember: boolean;
  planName: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  manageable: boolean;
  payments: {
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    paidAt: Date | null;
    createdAt: Date;
  }[];
};

function stripeId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    config: ConfigService,
  ) {
    this.webUrl = config.getOrThrow<string>('webUrl');
  }

  async membership(userId: string): Promise<MembershipView> {
    const [subscriptions, payments, user] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { userId },
        include: { plan: { select: { name: true } } },
      }),
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 24,
        select: {
          id: true,
          amountCents: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { stripeCustomerId: true },
      }),
    ]);
    const subscription = pickCurrent(subscriptions);
    return {
      status: subscription?.status ?? null,
      isMember: MEMBER_STATUSES.includes(subscription?.status ?? ''),
      planName: subscription?.plan?.name ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      // The portal opens as soon as a billing account exists, so a former
      // subscriber can still read their invoices.
      manageable: this.stripe.enabled && Boolean(user.stripeCustomerId),
      payments,
    };
  }

  async checkout(user: SelfUser, planId: string): Promise<{ url: string }> {
    const stripe = this.stripe.require();
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.active || !plan.stripePriceId) {
      throw new NotFoundException({ code: 'plan_not_found' });
    }
    const current = await this.prisma.subscription.findFirst({
      where: { userId: user.id, status: { in: BLOCKING_STATUSES } },
    });
    if (current) throw new ConflictException({ code: 'already_subscribed' });

    const customer = await this.ensureCustomer(user);
    // The local table only fills on webhook: ask Stripe too, so two tabs
    // cannot open two subscriptions before the first event lands.
    const remote = await stripe.subscriptions.list({
      customer,
      status: 'all',
      limit: 20,
    });
    if (remote.data.some((sub) => BLOCKING_STATUSES.includes(sub.status))) {
      throw new ConflictException({ code: 'already_subscribed' });
    }
    // Return URLs are built here, never received from the browser.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: user.id,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      metadata: { userId: user.id, planId: plan.id },
      subscription_data: { metadata: { userId: user.id, planId: plan.id } },
      success_url: `${this.webUrl}/abonnement?paiement=succes`,
      cancel_url: `${this.webUrl}/abonnement?paiement=annule`,
      locale: 'fr',
    });
    if (!session.url) throw new Error('Stripe returned no checkout URL');
    return { url: session.url };
  }

  async portal(userId: string): Promise<{ url: string }> {
    const stripe = this.stripe.require();
    const { stripeCustomerId } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });
    if (!stripeCustomerId) {
      throw new ConflictException({ code: 'no_billing_account' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${this.webUrl}/abonnement`,
      locale: 'fr',
    });
    return { url: session.url };
  }

  // Re-reads the subscription at Stripe: webhook order is not guaranteed and
  // an event payload may be older than the current state.
  async syncFromStripe(subscriptionId: string): Promise<void> {
    const stripe = this.stripe.require();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });
    const userId = await this.resolveUserId(
      stripeId(subscription.customer),
      subscription.metadata?.userId,
    );
    if (!userId) {
      this.logger.warn(`Subscription ${subscription.id} has no known user`);
      return;
    }

    const item = subscription.items.data[0];
    const productId = item ? stripeId(item.price.product) : null;
    // Matched on the product, not the price: subscribers keep their old price
    // after an amount change, and that price is no longer the plan's.
    const plan = productId
      ? await this.prisma.plan.findUnique({
          where: { stripeProductId: productId },
          select: { id: true },
        })
      : null;
    if (!plan) {
      this.logger.warn(
        `Subscription ${subscription.id} has an unknown product ${productId}`,
      );
    }

    const data = {
      userId,
      planId: plan?.id ?? null,
      status: subscription.status,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      create: { stripeSubscriptionId: subscription.id, ...data },
      update: data,
    });
  }

  async recordInvoice(
    invoice: Stripe.Invoice,
    status: 'PAID' | 'FAILED',
  ): Promise<void> {
    if (!invoice.id) return;
    const userId = await this.resolveUserId(stripeId(invoice.customer));
    if (!userId) {
      this.logger.warn(`Invoice ${invoice.id} has no known user`);
      return;
    }
    const paidAt = invoice.status_transitions?.paid_at;
    const data = {
      userId,
      amountCents: status === 'PAID' ? invoice.amount_paid : invoice.amount_due,
      currency: invoice.currency,
      status,
      paidAt: status === 'PAID' && paidAt ? new Date(paidAt * 1000) : null,
    };
    await this.prisma.payment.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: { stripeInvoiceId: invoice.id, ...data },
      // A failure notice arriving after the payment must not undo it.
      update: status === 'PAID' ? data : {},
    });

    const subscriptionId = stripeId(
      invoice.parent?.subscription_details?.subscription ?? null,
    );
    if (subscriptionId) await this.syncFromStripe(subscriptionId);
  }

  private async resolveUserId(
    customerId: string | null,
    metadataUserId?: string,
  ): Promise<string | null> {
    if (customerId) {
      const user = await this.prisma.user.findUnique({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });
      if (user) return user.id;
    }
    if (metadataUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: metadataUserId },
        select: { id: true },
      });
      if (user) return user.id;
    }
    return null;
  }

  private async ensureCustomer(user: SelfUser): Promise<string> {
    const { stripeCustomerId } = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    });
    if (stripeCustomerId) return stripeCustomerId;

    const customer = await this.stripe.require().customers.create(
      {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id },
      },
      // Keyed on the parameters too: Stripe refuses a reused key with new ones.
      {
        idempotencyKey: `customer-${user.id}-${createHash('sha256')
          .update(`${user.email}|${user.firstName}|${user.lastName}`)
          .digest('hex')
          .slice(0, 16)}`,
      },
    );
    // A concurrent checkout may have stored one first: keep the stored one.
    const { count } = await this.prisma.user.updateMany({
      where: { id: user.id, stripeCustomerId: null },
      data: { stripeCustomerId: customer.id },
    });
    if (!count) {
      const stored = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { stripeCustomerId: true },
      });
      return stored.stripeCustomerId ?? customer.id;
    }
    return customer.id;
  }
}
