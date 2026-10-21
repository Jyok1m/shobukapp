import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import type { SelfUser } from '../common/self-user';
import { MailService } from '../mail/mail.service';
import type { PlanInterval } from '../generated/prisma/enums';
import { frequencyOf } from './plans.service';
import { MODE_FIELDS, StripeMode, StripeService } from './stripe.service';

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
  planId: string | null;
  planName: string | null;
  frequency: PlanInterval | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  manageable: boolean;
  // Test mode: the page tells members payments are simulated.
  testMode: boolean;
  // Live mode, and a cotisation paid in test mode: it does not carry over.
  testCotisationNotCarried: boolean;
  payments: {
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    paidAt: Date | null;
    createdAt: Date;
  }[];
};

// Both columns, then picked by mode: a computed select key loses its type.
const CUSTOMER_SELECT = {
  stripeTestCustomerId: true,
  stripeLiveCustomerId: true,
} as const;

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
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webUrl = config.getOrThrow<string>('webUrl');
  }

  /*
   * After the switch to live: members holding a test cotisation learn it does
   * not carry over. Their profile, documents and messages do: only Stripe
   * objects depend on the mode.
   */
  async notifyTestCotisationsEnded(): Promise<number> {
    const members = await this.prisma.user.findMany({
      where: {
        subscriptions: {
          some: { livemode: false, status: { in: MEMBER_STATUSES } },
        },
      },
      select: { email: true, firstName: true },
    });
    for (const member of members) {
      await this.mail
        .send({
          to: member.email,
          subject: 'Shobukan Dojo : votre cotisation est à régler',
          text: [
            `Bonjour ${member.firstName},`,
            '',
            'Le dojo passe aux paiements réels. La cotisation réglée pendant la période de démonstration (carte de test) n’est pas reprise.',
            `Votre profil, vos documents et vos messages sont conservés. Il vous reste seulement à régler votre cotisation : ${this.webUrl}/cotisation`,
            '',
            'Le bureau du Shobukan Dojo',
          ].join('\n'),
        })
        .catch(() => undefined);
    }
    return members.length;
  }

  /*
   * Only the current mode counts: once Stripe goes live, a subscription paid
   * with a test card makes nobody a member, and its payments disappear from
   * the history (docs/billing.md, Modes).
   */
  async membership(userId: string): Promise<MembershipView> {
    const { mode, client } = await this.stripe.current();
    const livemode = mode === 'live';
    const [subscriptions, payments, user] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { userId, livemode },
        include: { plan: { select: { name: true } } },
      }),
      this.prisma.payment.findMany({
        where: { userId, livemode },
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
        select: CUSTOMER_SELECT,
      }),
    ]);
    const subscription = pickCurrent(subscriptions);
    const testLeftover =
      livemode &&
      !subscription &&
      (await this.prisma.subscription.count({
        where: { userId, livemode: false, status: { in: MEMBER_STATUSES } },
      })) > 0;
    return {
      status: subscription?.status ?? null,
      isMember: MEMBER_STATUSES.includes(subscription?.status ?? ''),
      planId: subscription?.planId ?? null,
      planName: subscription?.plan?.name ?? null,
      frequency: subscription?.frequency ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      // Open to a former member too, to read their invoices; not to someone
      // who only abandoned a checkout and has nothing to manage.
      manageable: Boolean(
        client &&
        user[MODE_FIELDS[mode].customer] &&
        (subscriptions.length > 0 || payments.length > 0),
      ),
      testMode: mode === 'test',
      testCotisationNotCarried: testLeftover,
      payments,
    };
  }

  async checkout(
    user: SelfUser,
    planId: string,
    frequency: PlanInterval,
  ): Promise<{ url: string }> {
    const { mode, client: stripe } = await this.stripe.requireCurrent();
    const price = await this.prisma.planPrice.findUnique({
      where: { planId_frequency: { planId, frequency } },
      include: { plan: { select: { id: true, active: true } } },
    });
    const priceId = price?.[MODE_FIELDS[mode].price];
    if (!price || !price.active || !price.plan.active || !priceId) {
      throw new NotFoundException({ code: 'plan_not_found' });
    }
    const plan = price.plan;
    const current = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        livemode: mode === 'live',
        status: { in: BLOCKING_STATUSES },
      },
    });
    if (current) throw new ConflictException({ code: 'already_subscribed' });

    const customer = await this.ensureCustomer(user, mode, stripe);
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
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, planId: plan.id, frequency },
      subscription_data: {
        metadata: { userId: user.id, planId: plan.id, frequency },
      },
      ...(mode === 'test' && {
        custom_text: {
          submit: {
            message:
              "Paiement de démonstration : utilisez la carte 4242 4242 4242 4242, une date d'expiration future et n'importe quel code. Aucune somme n'est débitée, et cette cotisation ne sera pas reprise quand le dojo passera aux paiements réels.",
          },
        },
      }),
      success_url: `${this.webUrl}/cotisation?paiement=succes`,
      cancel_url: `${this.webUrl}/cotisation?paiement=annule`,
      locale: 'fr',
    });
    if (!session.url) throw new Error('Stripe returned no checkout URL');
    return { url: session.url };
  }

  /*
   * Changing frequency (docs/billing.md, Changing frequency): same cotisation,
   * another of its prices. Stripe invoices the difference at once, crediting
   * the unused time; the change only applies if that payment succeeds.
   */
  private async frequencyChange(user: SelfUser, frequency: PlanInterval) {
    const { mode, client: stripe } = await this.stripe.requireCurrent();
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId: user.id, livemode: mode === 'live' },
    });
    const current = pickCurrent(subscriptions);
    if (
      !current ||
      !ACTIVE_STATUSES.includes(current.status) ||
      !current.planId
    ) {
      throw new ConflictException({ code: 'no_active_cotisation' });
    }
    if (current.frequency === frequency) {
      throw new ConflictException({ code: 'same_frequency' });
    }
    const price = await this.prisma.planPrice.findUnique({
      where: { planId_frequency: { planId: current.planId, frequency } },
    });
    const priceId = price?.active ? price[MODE_FIELDS[mode].price] : null;
    if (!priceId)
      throw new NotFoundException({ code: 'frequency_not_offered' });

    const remote = await stripe.subscriptions.retrieve(
      current.stripeSubscriptionId,
    );
    const item = remote.items.data[0];
    if (!item) throw new ConflictException({ code: 'no_active_cotisation' });
    return { stripe, mode, current, remote, item, priceId };
  }

  async previewFrequencyChange(user: SelfUser, frequency: PlanInterval) {
    const { stripe, remote, item, priceId } = await this.frequencyChange(
      user,
      frequency,
    );
    const invoice = await stripe.invoices.createPreview({
      customer: stripeId(remote.customer) ?? undefined,
      subscription: remote.id,
      subscription_details: {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: 'always_invoice',
      },
    });
    return {
      amountDueCents: invoice.amount_due,
      // Unused time worth more than the new price stays on the Stripe
      // customer and is deducted from the next payments.
      creditCents: Math.max(0, -(invoice.ending_balance ?? 0)),
      currency: invoice.currency,
    };
  }

  async changeFrequency(user: SelfUser, frequency: PlanInterval) {
    const { stripe, mode, remote, item, priceId } = await this.frequencyChange(
      user,
      frequency,
    );
    await stripe.subscriptions.update(remote.id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: 'always_invoice',
      // Not applied until the prorated invoice is paid: a declined card
      // leaves the current frequency in place.
      payment_behavior: 'pending_if_incomplete',
    });
    await this.syncFromStripe(remote.id, mode);
    return this.membership(user.id);
  }

  async portal(userId: string): Promise<{ url: string }> {
    const { mode, client: stripe } = await this.stripe.requireCurrent();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: CUSTOMER_SELECT,
    });
    const customer = user[MODE_FIELDS[mode].customer];
    if (!customer) {
      throw new ConflictException({ code: 'no_billing_account' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${this.webUrl}/cotisation`,
      locale: 'fr',
    });
    return { url: session.url };
  }

  // Re-reads the subscription at Stripe: webhook order is not guaranteed and
  // an event payload may be older than the current state.
  async syncFromStripe(
    subscriptionId: string,
    mode: StripeMode,
  ): Promise<void> {
    const stripe = this.stripe.require(mode);
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });
    const userId = await this.resolveUserId(
      mode,
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
      ? await this.prisma.plan.findFirst({
          where: { [MODE_FIELDS[mode].product]: productId },
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
      frequency: item ? frequencyOf(item.price.recurring) : null,
      status: subscription.status,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      livemode: subscription.livemode,
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
    const mode: StripeMode = invoice.livemode ? 'live' : 'test';
    const userId = await this.resolveUserId(mode, stripeId(invoice.customer));
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
      livemode: invoice.livemode,
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
    if (subscriptionId) await this.syncFromStripe(subscriptionId, mode);
  }

  private async resolveUserId(
    mode: StripeMode,
    customerId: string | null,
    metadataUserId?: string,
  ): Promise<string | null> {
    if (customerId) {
      const user = await this.prisma.user.findFirst({
        where: { [MODE_FIELDS[mode].customer]: customerId },
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

  private async ensureCustomer(
    user: SelfUser,
    mode: StripeMode,
    stripe: Stripe,
  ): Promise<string> {
    const field = MODE_FIELDS[mode].customer;
    const stored = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: CUSTOMER_SELECT,
    });
    if (stored[field]) return stored[field];

    const customer = await stripe.customers.create(
      {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id },
      },
      // Keyed on the parameters too: Stripe refuses a reused key with new ones.
      {
        idempotencyKey: `customer-${mode}-${user.id}-${createHash('sha256')
          .update(`${user.email}|${user.firstName}|${user.lastName}`)
          .digest('hex')
          .slice(0, 16)}`,
      },
    );
    // A concurrent checkout may have stored one first: keep the stored one.
    const { count } = await this.prisma.user.updateMany({
      where: { id: user.id, [field]: null },
      data: { [field]: customer.id },
    });
    if (!count) {
      const again = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: CUSTOMER_SELECT,
      });
      return again[field] ?? customer.id;
    }
    return customer.id;
  }
}
