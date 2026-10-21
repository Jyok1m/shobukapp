import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import type { Plan, PlanPrice } from '../generated/prisma/client';
import type { PlanInterval } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, PlanPriceDto, UpdatePlanDto } from './dto/plan.dto';
import { MODE_FIELDS, StripeMode, StripeService } from './stripe.service';

export const FREQUENCY_ORDER: PlanInterval[] = ['YEAR', 'QUARTER', 'MONTH'];

// Quarterly is a monthly price billed every three months.
export const STRIPE_RECURRING: Record<
  PlanInterval,
  { interval: 'month' | 'year'; interval_count: number }
> = {
  YEAR: { interval: 'year', interval_count: 1 },
  QUARTER: { interval: 'month', interval_count: 3 },
  MONTH: { interval: 'month', interval_count: 1 },
};

export function frequencyOf(
  recurring: {
    interval: string;
    interval_count: number;
  } | null,
): PlanInterval | null {
  if (!recurring) return null;
  if (recurring.interval === 'year' && recurring.interval_count === 1) {
    return 'YEAR';
  }
  if (recurring.interval === 'month' && recurring.interval_count === 3) {
    return 'QUARTER';
  }
  if (recurring.interval === 'month' && recurring.interval_count === 1) {
    return 'MONTH';
  }
  return null;
}

type PlanWithPrices = Plan & { prices: PlanPrice[] };

export type PublicPlan = Pick<
  Plan,
  'id' | 'name' | 'description' | 'currency'
> & {
  prices: {
    frequency: PlanInterval;
    amountCents: number;
    purchasable: boolean;
  }[];
};

export type AdminPlan = PlanWithPrices & { synced: boolean };

const withPrices = { prices: true } as const;

function sortPrices<T extends { frequency: PlanInterval }>(prices: T[]): T[] {
  return [...prices].sort(
    (a, b) =>
      FREQUENCY_ORDER.indexOf(a.frequency) -
      FREQUENCY_ORDER.indexOf(b.frequency),
  );
}

/*
 * A cotisation is one plan with up to three prices, one per frequency
 * (docs/billing.md, Frequencies). Stripe is written before the database: an
 * orphan product or price is harmless, a row pointing to a missing price
 * breaks a payment. Edits reach the current mode only; switching modes brings
 * the other one up to date.
 */
@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  async listPublic(): Promise<PublicPlan[]> {
    const { mode, client } = await this.stripe.current();
    const plans = await this.prisma.plan.findMany({
      where: { active: true, prices: { some: { active: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: withPrices,
    });
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      currency: plan.currency,
      prices: sortPrices(plan.prices.filter((p) => p.active)).map((p) => ({
        frequency: p.frequency,
        amountCents: p.amountCents,
        purchasable: Boolean(client && p[MODE_FIELDS[mode].price]),
      })),
    }));
  }

  async listAll(): Promise<AdminPlan[]> {
    const mode = await this.stripe.mode();
    const plans = await this.prisma.plan.findMany({
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: withPrices,
    });
    return plans.map((plan) => this.toAdmin(plan, mode));
  }

  // The same shape on every admin route, so a form can trust `synced`.
  private toAdmin(plan: PlanWithPrices, mode: StripeMode): AdminPlan {
    return {
      ...plan,
      prices: sortPrices(plan.prices),
      synced:
        Boolean(plan[MODE_FIELDS[mode].product]) &&
        plan.prices
          .filter((p) => p.active)
          .every((p) => Boolean(p[MODE_FIELDS[mode].price])),
    };
  }

  async create(dto: CreatePlanDto): Promise<AdminPlan> {
    const prices = this.validatePrices(dto.prices, true);
    const id = randomUUID();
    const draft: PlanWithPrices = {
      id,
      name: dto.name,
      description: dto.description ?? null,
      currency: 'eur',
      active: true,
      sortOrder: dto.sortOrder ?? 0,
      stripeTestProductId: null,
      stripeLiveProductId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      prices: prices.map((p) => this.priceRow(id, p)),
    };
    const { mode, client } = await this.stripe.current();
    const synced = client
      ? await this.syncPlan(client, mode, draft, draft)
      : draft;
    const created = await this.prisma.plan.create({
      data: {
        id,
        name: synced.name,
        description: synced.description,
        sortOrder: synced.sortOrder,
        stripeTestProductId: synced.stripeTestProductId,
        stripeLiveProductId: synced.stripeLiveProductId,
        prices: {
          create: synced.prices.map((p) => ({
            frequency: p.frequency,
            amountCents: p.amountCents,
            active: p.active,
            stripeTestPriceId: p.stripeTestPriceId,
            stripeLivePriceId: p.stripeLivePriceId,
          })),
        },
      },
      include: withPrices,
    });
    return this.toAdmin(created, mode);
  }

  async update(id: string, dto: UpdatePlanDto): Promise<AdminPlan> {
    const current = await this.find(id);
    const next = this.applyUpdate(current, dto);
    const { mode, client } = await this.stripe.current();
    const synced = client
      ? await this.syncPlan(client, mode, current, next)
      : next;
    return this.toAdmin(await this.save(synced), mode);
  }

  // Archive, never delete: a plan someone still pays cannot disappear.
  archive(id: string): Promise<AdminPlan> {
    return this.update(id, { active: false });
  }

  async find(id: string): Promise<PlanWithPrices> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: withPrices,
    });
    if (!plan) throw new NotFoundException({ code: 'plan_not_found' });
    return plan;
  }

  /*
   * Before a mode switch: every plan gets this mode's product and prices as
   * the rows describe them now, comparing with Stripe's own prices, so edits
   * made in the other mode meanwhile are caught up.
   */
  async syncAllForMode(mode: StripeMode): Promise<void> {
    const client = this.stripe.require(mode);
    const plans = await this.prisma.plan.findMany({ include: withPrices });
    for (const plan of plans) {
      const synced = await this.syncPlan(client, mode, plan, plan, true);
      await this.save(synced);
    }
  }

  private validatePrices(prices: PlanPriceDto[], requireOffered: boolean) {
    const seen = new Set(prices.map((p) => p.frequency));
    if (seen.size !== prices.length) {
      throw new BadRequestException({ code: 'duplicate_frequency' });
    }
    if (requireOffered && !prices.some((p) => p.active)) {
      throw new BadRequestException({ code: 'no_frequency_offered' });
    }
    return prices;
  }

  private priceRow(planId: string, p: PlanPriceDto): PlanPrice {
    return {
      id: randomUUID(),
      planId,
      frequency: p.frequency,
      amountCents: p.amountCents,
      active: p.active,
      stripeTestPriceId: null,
      stripeLivePriceId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private applyUpdate(
    current: PlanWithPrices,
    dto: UpdatePlanDto,
  ): PlanWithPrices {
    const next: PlanWithPrices = {
      ...current,
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.active !== undefined && { active: dto.active }),
      prices: current.prices.map((p) => ({ ...p })),
    };
    if (dto.prices) {
      this.validatePrices(dto.prices, false);
      for (const input of dto.prices) {
        const existing = next.prices.find(
          (p) => p.frequency === input.frequency,
        );
        if (existing) {
          existing.amountCents = input.amountCents;
          existing.active = input.active;
        } else {
          next.prices.push(this.priceRow(current.id, input));
        }
      }
      if (!next.prices.some((p) => p.active)) {
        throw new BadRequestException({ code: 'no_frequency_offered' });
      }
    }
    return next;
  }

  private async save(plan: PlanWithPrices): Promise<PlanWithPrices> {
    return this.prisma.$transaction(async (tx) => {
      await tx.plan.update({
        where: { id: plan.id },
        data: {
          name: plan.name,
          description: plan.description,
          sortOrder: plan.sortOrder,
          active: plan.active,
          stripeTestProductId: plan.stripeTestProductId,
          stripeLiveProductId: plan.stripeLiveProductId,
        },
      });
      for (const p of plan.prices) {
        const data = {
          amountCents: p.amountCents,
          active: p.active,
          stripeTestPriceId: p.stripeTestPriceId,
          stripeLivePriceId: p.stripeLivePriceId,
        };
        await tx.planPrice.upsert({
          where: {
            planId_frequency: { planId: plan.id, frequency: p.frequency },
          },
          create: { planId: plan.id, frequency: p.frequency, ...data },
          update: data,
        });
      }
      return tx.plan.findUniqueOrThrow({
        where: { id: plan.id },
        include: withPrices,
      });
    });
  }

  /*
   * Returns `next` with this mode's Stripe ids filled in. A Stripe price is
   * immutable: a new amount means a new price, the old one deactivated;
   * existing subscribers keep theirs until they change.
   */
  private async syncPlan(
    client: Stripe,
    mode: StripeMode,
    current: PlanWithPrices,
    next: PlanWithPrices,
    compareRemote = false,
  ): Promise<PlanWithPrices> {
    const result: PlanWithPrices = {
      ...next,
      prices: next.prices.map((p) => ({ ...p })),
    };
    const productField = MODE_FIELDS[mode].product;
    let productId = current[productField];
    const sells = next.active && next.prices.some((p) => p.active);

    if (!productId) {
      // A plan never sold in this mode and not on sale has nothing to create.
      if (!sells) return result;
      const product = await client.products.create(
        {
          name: next.name,
          ...(next.description && { description: next.description }),
          metadata: { planId: next.id },
        },
        { idempotencyKey: `plan-product-${mode}-${next.id}` },
      );
      productId = product.id;
    } else {
      await client.products.update(productId, {
        name: next.name,
        description: next.description ?? '',
        active: next.active,
      });
    }
    result[productField] = productId;

    for (const price of result.prices) {
      const field = MODE_FIELDS[mode].price;
      const previous = current.prices.find(
        (p) => p.frequency === price.frequency,
      );
      const priceId = price[field];
      const onSale = next.active && price.active;

      let stale =
        !priceId || (previous && previous.amountCents !== price.amountCents);
      if (!stale && compareRemote && priceId) {
        const remote = await client.prices.retrieve(priceId);
        stale =
          remote.unit_amount !== price.amountCents ||
          frequencyOf(remote.recurring) !== price.frequency;
      }

      if (stale && onSale) {
        const created = await client.prices.create(
          {
            product: productId,
            unit_amount: price.amountCents,
            currency: next.currency,
            recurring: STRIPE_RECURRING[price.frequency],
            metadata: { planId: next.id, frequency: price.frequency },
          },
          // Random per call: a key derived from the amount would hand back an
          // old, possibly deactivated price when an admin returns to it.
          { idempotencyKey: `plan-price-${next.id}-${randomUUID()}` },
        );
        this.logger.log(
          `Created Stripe price ${created.id} for plan ${next.id} (${price.frequency})`,
        );
        if (priceId) await client.prices.update(priceId, { active: false });
        price[field] = created.id;
      } else if (stale && priceId) {
        // Changed while not on sale: the old price must never come back with
        // the old amount, so it is dropped and recreated when offered again.
        await client.prices.update(priceId, { active: false });
        price[field] = null;
      } else if (priceId) {
        await client.prices.update(priceId, { active: onSale });
      }
    }
    return result;
  }
}
