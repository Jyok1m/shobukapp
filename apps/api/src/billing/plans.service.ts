import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Plan } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { StripeService } from './stripe.service';

export type PublicPlan = Pick<
  Plan,
  'id' | 'name' | 'description' | 'amountCents' | 'currency' | 'interval'
> & { purchasable: boolean };

/*
 * DTO instances carry every declared field, undefined when absent
 * (useDefineForClassFields): spreading one would erase the current values.
 */
function definedOnly<T extends object>(dto: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(dto).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

const STRIPE_INTERVAL = { MONTH: 'month', YEAR: 'year' } as const;

// Stripe is written before the database: an orphan product is harmless, a row
// pointing to a missing price breaks a payment (docs/billing.md).
@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  async listPublic(): Promise<PublicPlan[]> {
    const plans = await this.prisma.plan.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      amountCents: plan.amountCents,
      currency: plan.currency,
      interval: plan.interval,
      purchasable: this.stripe.enabled && Boolean(plan.stripePriceId),
    }));
  }

  listAll(): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreatePlanDto): Promise<Plan> {
    const id = randomUUID();
    const stripeIds = this.stripe.enabled
      ? await this.createStripeProduct(id, dto)
      : {};
    return this.prisma.plan.create({
      data: { id, ...dto, ...stripeIds },
    });
  }

  async update(id: string, input: UpdatePlanDto): Promise<Plan> {
    const plan = await this.find(id);
    const dto = definedOnly(input);
    const next = { ...plan, ...dto };
    let stripeIds: { stripeProductId?: string; stripePriceId?: string } = {};

    if (this.stripe.enabled) {
      if (!plan.stripeProductId) {
        stripeIds = await this.createStripeProduct(plan.id, next);
      } else {
        stripeIds = await this.syncStripeProduct(plan, next);
      }
    }

    return this.prisma.plan.update({
      where: { id },
      data: { ...dto, ...stripeIds },
    });
  }

  // Archive, never delete: a plan someone still pays cannot disappear.
  archive(id: string): Promise<Plan> {
    return this.update(id, { active: false });
  }

  async find(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException({ code: 'plan_not_found' });
    return plan;
  }

  private async createStripeProduct(
    planId: string,
    plan: Pick<Plan, 'name' | 'amountCents' | 'interval'> &
      Partial<Pick<Plan, 'description' | 'currency' | 'active'>>,
  ): Promise<{ stripeProductId: string; stripePriceId: string }> {
    const stripe = this.stripe.require();
    const product = await stripe.products.create(
      {
        name: plan.name,
        ...(plan.description && { description: plan.description }),
        active: plan.active ?? true,
        metadata: { planId },
      },
      { idempotencyKey: `plan-product-${planId}` },
    );
    const price = await this.createPrice(product.id, planId, plan);
    return { stripeProductId: product.id, stripePriceId: price };
  }

  private async syncStripeProduct(
    current: Plan,
    next: Plan,
  ): Promise<{ stripePriceId?: string }> {
    const stripe = this.stripe.require();
    const productId = current.stripeProductId!;

    if (
      current.name !== next.name ||
      current.description !== next.description ||
      current.active !== next.active
    ) {
      await stripe.products.update(productId, {
        name: next.name,
        description: next.description ?? '',
        active: next.active,
      });
    }

    // A Stripe price is immutable: a new amount or interval means a new price.
    const priceChanged =
      current.amountCents !== next.amountCents ||
      current.interval !== next.interval ||
      !current.stripePriceId;
    if (priceChanged) {
      const priceId = await this.createPrice(productId, current.id, next);
      if (current.stripePriceId && current.stripePriceId !== priceId) {
        await stripe.prices.update(current.stripePriceId, { active: false });
      }
      return { stripePriceId: priceId };
    }

    if (current.stripePriceId && current.active !== next.active) {
      await stripe.prices.update(current.stripePriceId, {
        active: next.active,
      });
    }
    return {};
  }

  private async createPrice(
    productId: string,
    planId: string,
    plan: Pick<Plan, 'amountCents' | 'interval'> &
      Partial<Pick<Plan, 'currency' | 'active'>>,
  ): Promise<string> {
    const price = await this.stripe.require().prices.create(
      {
        product: productId,
        unit_amount: plan.amountCents,
        currency: plan.currency ?? 'eur',
        recurring: { interval: STRIPE_INTERVAL[plan.interval] },
        active: plan.active ?? true,
        metadata: { planId },
      },
      // Random per call: a key derived from the amount would hand back an old,
      // possibly deactivated price when an admin returns to a previous amount.
      { idempotencyKey: `plan-price-${planId}-${randomUUID()}` },
    );
    this.logger.log(`Created Stripe price ${price.id} for plan ${planId}`);
    return price.id;
  }
}
