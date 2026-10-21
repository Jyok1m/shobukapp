import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import type { Charge, Prisma, Product } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import type { SelfUser } from '../../common/self-user';
import type { GridProduct } from '../grids';
import {
  MODE_FIELDS,
  STRIPE_MODES,
  StripeMode,
  StripeService,
} from '../stripe.service';
import { SubscriptionsService } from '../subscriptions.service';
import { RequestChargeDto, UpdateProductDto } from './products.dto';
import { currentSeason } from './season';

const chargeView = {
  id: true,
  amountCents: true,
  currency: true,
  status: true,
  method: true,
  season: true,
  note: true,
  stripePaymentLinkUrl: true,
  paidAt: true,
  createdAt: true,
  product: { select: { id: true, slug: true, name: true, kind: true } },
} as const;

/*
 * Charges that count in a Stripe mode: its own, plus what happened off
 * Stripe (paid at the dojo, declined, waived), which is real in both.
 */
export function chargesOfMode(livemode: boolean): Prisma.ChargeWhereInput {
  return {
    OR: [
      { livemode },
      { method: 'MANUAL' },
      { status: { in: ['DECLINED', 'WAIVED'] } },
    ],
  };
}

const TEST_NOTICE = {
  custom_text: {
    submit: {
      message:
        'Paiement de démonstration : utilisez la carte 4242 4242 4242 4242. Aucune somme n’est débitée.',
    },
  },
};

function euros(cents: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(
    cents / 100,
  );
}

/*
 * One-off products and what members owe for them (docs/billing.md, One-off
 * products). The bureau sends a Stripe payment link or records a payment made
 * by hand; members buy the "member purchasable" ones themselves. Payment
 * links are not tied to a login, so a link forwarded by mail still works.
 */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly subscriptions: SubscriptionsService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webUrl = config.getOrThrow<string>('webUrl');
  }

  // Catalog

  listAdmin(): Promise<Product[]> {
    return this.prisma.product.findMany({
      orderBy: [{ active: 'desc' }, { kind: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async listForMembers() {
    const { client } = await this.stripe.current();
    const products = await this.prisma.product.findMany({
      where: { active: true, memberPurchasable: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        amountCents: true,
        currency: true,
      },
    });
    return products.map((p) => ({ ...p, purchasable: Boolean(client) }));
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const current = await this.find(id);
    const data = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as UpdateProductDto;
    const next = { ...current, ...data };
    const { mode, client } = await this.stripe.current();
    const ids: Record<string, string | null> = client
      ? await this.syncStripe(client, mode, current, next)
      : {};
    if (next.amountCents !== current.amountCents) {
      // The other mode's price has the old amount: recreated on its next use.
      for (const other of STRIPE_MODES.filter((m) => m !== mode || !client)) {
        ids[MODE_FIELDS[other].price] = null;
      }
    }
    return this.prisma.product.update({
      where: { id },
      data: { ...data, ...ids },
    });
  }

  async upsertFromGrid(product: GridProduct, sortOrder: number) {
    const existing = await this.prisma.product.findUnique({
      where: { slug: product.slug },
    });
    const base = existing
      ? existing
      : await this.prisma.product.create({ data: { ...product, sortOrder } });
    return this.update(base.id, {
      name: product.name,
      description: product.description,
      amountCents: product.amountCents,
      memberPurchasable: product.memberPurchasable,
      active: true,
    });
  }

  // Charges

  // A handful per member and season: no cursor needed.
  listForMember(userId: string) {
    return this.prisma.charge.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: chargeView,
    });
  }

  // What the member sees: their charges, a pay link only while pending.
  async listMine(userId: string) {
    const rows = await this.listForMember(userId);
    return rows.map((row) => ({
      ...row,
      stripePaymentLinkUrl:
        row.status === 'PENDING' ? row.stripePaymentLinkUrl : null,
    }));
  }

  async request(admin: SelfUser, userId: string, dto: RequestChargeDto) {
    const member = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!member) throw new NotFoundException({ code: 'member_not_found' });
    const product = await this.find(dto.productId);
    if (!product.active) {
      throw new BadRequestException({ code: 'product_inactive' });
    }
    const season = product.perSeason ? currentSeason() : null;
    const { mode } = await this.stripe.current();
    const livemode = mode === 'live';
    const charge = await this.prisma.$transaction(async (tx) => {
      // Two clicks or two tabs: the second waits, then sees the first charge.
      await this.lock(tx, userId, product.id);
      // Licence: once per season. Passport: one pending at a time.
      const duplicate = season
        ? { season, status: { in: ['PENDING' as const, 'PAID' as const] } }
        : product.kind === 'FEDERATION'
          ? { status: 'PENDING' as const }
          : null;
      if (duplicate) {
        const open = await tx.charge.count({
          where: {
            userId,
            productId: product.id,
            ...duplicate,
            ...chargesOfMode(livemode),
          },
        });
        if (open) throw new ConflictException({ code: 'charge_exists' });
      }
      return tx.charge.create({
        data: {
          userId,
          productId: product.id,
          amountCents: product.amountCents,
          currency: product.currency,
          season,
          note: dto.note ?? null,
          livemode,
          createdById: admin.id,
        },
      });
    });
    if (dto.sendLink) return this.sendLink(charge.id);
    return this.view(charge.id);
  }

  /*
   * Creates the payment link once and mails it; calling again re-sends the
   * same link. One completed payment closes it. The charge takes the
   * product's current amount when its link is created, so the mail and the
   * link always agree.
   */
  async sendLink(chargeId: string) {
    let charge = await this.findCharge(chargeId);
    if (charge.status !== 'PENDING') {
      throw new ConflictException({ code: 'charge_not_pending' });
    }
    const { mode, client } = await this.stripe.requireCurrent();
    if (charge.livemode !== (mode === 'live')) {
      // A test charge must never get a live link, nor the reverse.
      throw new ConflictException({ code: 'charge_other_mode' });
    }
    if (!charge.stripePaymentLinkUrl) {
      const priceId = await this.priceFor(client, mode, charge.product.id);
      const product = await this.find(charge.product.id);
      if (product.amountCents !== charge.amountCents) {
        await this.prisma.charge.update({
          where: { id: charge.id },
          data: { amountCents: product.amountCents },
        });
      }
      const link = await client.paymentLinks.create(
        {
          line_items: [{ price: priceId, quantity: 1 }],
          payment_method_types: ['card'],
          metadata: { chargeId: charge.id },
          payment_intent_data: { metadata: { chargeId: charge.id } },
          restrictions: { completed_sessions: { limit: 1 } },
          after_completion: {
            type: 'redirect',
            redirect: { url: `${this.webUrl}/tableau-de-bord?paiement=succes` },
          },
          ...(mode === 'test' && TEST_NOTICE),
        },
        { idempotencyKey: `charge-link-${charge.id}-${priceId}` },
      );
      await this.prisma.charge.update({
        where: { id: charge.id },
        data: { stripePaymentLinkId: link.id, stripePaymentLinkUrl: link.url },
      });
      charge = await this.findCharge(chargeId);
    }
    const delivery = await this.mail
      .send({
        to: charge.user.email,
        subject: `Shobukan Dojo : ${charge.product.name}`,
        text: [
          `Bonjour ${charge.user.firstName},`,
          '',
          `Le bureau vous invite à régler : ${charge.product.name}${charge.season ? ` (saison ${charge.season})` : ''}, ${euros(charge.amountCents, charge.currency)}.`,
          `Paiement sécurisé en ligne : ${charge.stripePaymentLinkUrl}`,
          ...(charge.note ? ['', charge.note] : []),
          '',
          'Le bureau du Shobukan Dojo',
        ].join('\n'),
      })
      .catch(() => 'failed' as const);
    return { ...(await this.view(charge.id)), delivery };
  }

  // The bureau records a payment by hand, a refusal, or waives it.
  async setStatus(
    chargeId: string,
    status: 'PENDING' | 'PAID' | 'DECLINED' | 'WAIVED',
  ) {
    const charge = await this.findCharge(chargeId);
    // Conditional write: a webhook settling it meanwhile wins.
    const { count } = await this.prisma.charge.updateMany({
      where: { id: chargeId, NOT: { status: 'PAID', method: 'STRIPE' } },
      data: {
        status,
        method: status === 'PAID' ? 'MANUAL' : null,
        paidAt: status === 'PAID' ? new Date() : null,
      },
    });
    if (!count) {
      // Paid online: Stripe holds the money, a refund goes through Stripe.
      throw new ConflictException({ code: 'charge_paid_online' });
    }
    await this.setLinkActive(charge, status === 'PENDING');
    return this.view(chargeId);
  }

  // A member buys a "member purchasable" product: one Checkout session.
  async memberCheckout(user: SelfUser, productId: string) {
    const product = await this.find(productId);
    if (!product.active || !product.memberPurchasable) {
      throw new NotFoundException({ code: 'product_not_found' });
    }
    const { mode, client } = await this.stripe.requireCurrent();
    const priceId = await this.priceFor(client, mode, product.id);
    const livemode = mode === 'live';
    const { charge, previousSession } = await this.prisma.$transaction(
      async (tx) => {
        await this.lock(tx, user.id, product.id);
        // An abandoned attempt is reused, not piled up as a new pending row.
        const open = await tx.charge.findFirst({
          where: {
            userId: user.id,
            productId: product.id,
            status: 'PENDING',
            livemode,
            stripePaymentLinkId: null,
            stripeCheckoutSessionId: { not: null },
          },
        });
        if (open) {
          const reused = await tx.charge.update({
            where: { id: open.id },
            data: { amountCents: product.amountCents },
          });
          return {
            charge: reused,
            previousSession: open.stripeCheckoutSessionId,
          };
        }
        const created = await tx.charge.create({
          data: {
            userId: user.id,
            productId: product.id,
            amountCents: product.amountCents,
            currency: product.currency,
            livemode,
          },
        });
        return { charge: created, previousSession: null };
      },
    );
    if (previousSession) {
      // Only the newest session may take the payment.
      await client.checkout.sessions
        .expire(previousSession)
        .catch(() => undefined);
    }
    const customer = await this.subscriptions.ensureCustomer(
      user,
      mode,
      client,
    );
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      customer,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      // Immediate methods only: a delayed one would leave the charge pending.
      allowed_payment_method_types: ['card'],
      metadata: { chargeId: charge.id },
      payment_intent_data: { metadata: { chargeId: charge.id } },
      success_url: `${this.webUrl}/tableau-de-bord?paiement=succes`,
      cancel_url: `${this.webUrl}/tableau-de-bord`,
      locale: 'fr',
      ...(mode === 'test' && TEST_NOTICE),
    });
    await this.prisma.charge.update({
      where: { id: charge.id },
      data: { stripeCheckoutSessionId: session.id },
    });
    if (!session.url) throw new Error('Stripe returned no checkout URL');
    return { url: session.url };
  }

  /*
   * checkout.session.completed in payment mode, from a payment link or from a
   * member's own checkout. Matched on the charge id the session carries, else
   * on the link or session id. A replay finds the charge already paid.
   */
  async markPaidFromSession(session: Stripe.Checkout.Session): Promise<void> {
    if (session.mode !== 'payment' || session.payment_status !== 'paid') return;
    const linkId =
      typeof session.payment_link === 'string'
        ? session.payment_link
        : (session.payment_link?.id ?? null);
    const charge = await this.prisma.charge.findFirst({
      where: {
        livemode: session.livemode,
        OR: [
          ...(session.metadata?.chargeId
            ? [{ id: session.metadata.chargeId }]
            : []),
          ...(linkId ? [{ stripePaymentLinkId: linkId }] : []),
          { stripeCheckoutSessionId: session.id },
        ],
      },
    });
    if (!charge) {
      this.logger.warn(`Payment session ${session.id} matches no charge`);
      return;
    }
    if (charge.status === 'PAID' && charge.method === 'STRIPE') return;
    // Money received online wins over any status the bureau set meanwhile.
    await this.prisma.charge.update({
      where: { id: charge.id },
      data: {
        status: 'PAID',
        method: 'STRIPE',
        paidAt: new Date(),
        stripeCheckoutSessionId: session.id,
      },
    });
    await this.setLinkActive(charge, false);
  }

  // Internals

  async find(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException({ code: 'product_not_found' });
    return product;
  }

  private async findCharge(id: string) {
    const charge = await this.prisma.charge.findUnique({
      where: { id },
      include: {
        product: true,
        user: { select: { email: true, firstName: true } },
      },
    });
    if (!charge) throw new NotFoundException({ code: 'charge_not_found' });
    return charge;
  }

  private view(id: string) {
    return this.prisma.charge.findUniqueOrThrow({
      where: { id },
      select: chargeView,
    });
  }

  private async lock(
    tx: Prisma.TransactionClient,
    userId: string,
    productId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`charge:${userId}:${productId}`}))::text`;
  }

  // The product's price in this mode, created or replaced when needed.
  private async priceFor(
    client: Stripe,
    mode: StripeMode,
    productId: string,
  ): Promise<string> {
    const product = await this.find(productId);
    const ids = await this.syncStripe(client, mode, product, product);
    if (Object.keys(ids).length) {
      await this.prisma.product.update({ where: { id: productId }, data: ids });
    }
    return ids[MODE_FIELDS[mode].price] ?? product[MODE_FIELDS[mode].price]!;
  }

  /*
   * A settled charge closes its link so it cannot take a second payment; a
   * charge reopened by the bureau reopens it (never completed, since a link
   * paid online cannot be reopened).
   */
  private async setLinkActive(charge: Charge, active: boolean): Promise<void> {
    if (!charge.stripePaymentLinkId) return;
    const client = this.stripe.client(charge.livemode ? 'live' : 'test');
    await client?.paymentLinks
      .update(charge.stripePaymentLinkId, { active })
      .catch((error: unknown) =>
        this.logger.warn(
          `Could not set ${charge.stripePaymentLinkId} active=${active}: ${String(error)}`,
        ),
      );
  }

  /*
   * One Stripe product and one one-time price per mode. A price is immutable:
   * a new amount is a new price. The old one stays active: links already
   * sent keep working at the amount they announced.
   */
  private async syncStripe(
    client: Stripe,
    mode: StripeMode,
    current: Product,
    next: Product,
  ): Promise<Record<string, string>> {
    const fields = MODE_FIELDS[mode];
    const ids: Record<string, string> = {};
    let productId = current[fields.product];
    if (!productId) {
      const created = await client.products.create(
        {
          name: next.name,
          ...(next.description && { description: next.description }),
          metadata: { productId: current.id, kind: current.kind },
        },
        { idempotencyKey: `one-off-product-${mode}-${current.id}` },
      );
      productId = created.id;
      ids[fields.product] = productId;
    } else if (
      current.name !== next.name ||
      current.description !== next.description ||
      current.active !== next.active
    ) {
      await client.products.update(productId, {
        name: next.name,
        description: next.description ?? '',
        active: next.active,
      });
    }
    const priceId = current[fields.price];
    if (!priceId || current.amountCents !== next.amountCents) {
      const price = await client.prices.create(
        {
          product: productId,
          unit_amount: next.amountCents,
          currency: next.currency,
          metadata: { productId: current.id },
        },
        // Two concurrent first uses share one price; the replaced id in the
        // key keeps a return to an old amount from reviving an old price.
        {
          idempotencyKey: `one-off-price-${current.id}-${mode}-${next.amountCents}-${priceId ?? 'none'}`,
        },
      );
      ids[fields.price] = price.id;
    }
    return ids;
  }
}
