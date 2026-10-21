import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import type { Plan } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { MODE_FIELDS, StripeMode, StripeService } from './stripe.service';

export type PublicPlan = Pick<
  Plan,
  'id' | 'name' | 'description' | 'amountCents' | 'currency' | 'interval'
> & { purchasable: boolean };

export type AdminPlan = Plan & { synced: boolean };

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

type PlanShape = Pick<
  Plan,
  'name' | 'description' | 'amountCents' | 'currency' | 'interval' | 'active'
>;

function ids(plan: Plan, mode: StripeMode) {
  const fields = MODE_FIELDS[mode];
  return { productId: plan[fields.product], priceId: plan[fields.price] };
}

/*
 * Stripe is written before the database: an orphan product is harmless, a row
 * pointing to a missing price breaks a payment (docs/billing.md). Edits reach
 * the current mode only; switching modes brings the other one up to date.
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
      purchasable: Boolean(client && ids(plan, mode).priceId),
    }));
  }

  async listAll(): Promise<AdminPlan[]> {
    const mode = await this.stripe.mode();
    const plans = await this.prisma.plan.findMany({
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return plans.map((plan) => ({
      ...plan,
      synced: Boolean(ids(plan, mode).priceId),
    }));
  }

  async create(dto: CreatePlanDto): Promise<Plan> {
    const { mode, client } = await this.stripe.current();
    const id = randomUUID();
    const shape: PlanShape = {
      name: dto.name,
      description: dto.description ?? null,
      amountCents: dto.amountCents,
      interval: dto.interval,
      currency: 'eur',
      active: true,
    };
    const stripeIds = client
      ? await this.createProduct(client, mode, id, shape)
      : {};
    return this.prisma.plan.create({ data: { id, ...dto, ...stripeIds } });
  }

  async update(id: string, input: UpdatePlanDto): Promise<Plan> {
    const plan = await this.find(id);
    const dto = definedOnly(input);
    const { mode, client } = await this.stripe.current();
    const stripeIds = client
      ? await this.syncMode(client, mode, plan, { ...plan, ...dto })
      : {};
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

  /*
   * Before a mode switch: every plan gets this mode's product and price as the
   * row describes it now. Edits made in the other mode meanwhile (an amount, a
   * name, an archive) are caught up here, so the switch leaves no stale price.
   */
  async syncAllForMode(mode: StripeMode): Promise<void> {
    const client = this.stripe.require(mode);
    const plans = await this.prisma.plan.findMany();
    for (const plan of plans) {
      const stripeIds = await this.syncMode(client, mode, plan, plan, true);
      if (Object.keys(stripeIds).length) {
        await this.prisma.plan.update({
          where: { id: plan.id },
          data: stripeIds,
        });
      }
    }
  }

  private async syncMode(
    client: Stripe,
    mode: StripeMode,
    current: Plan,
    next: PlanShape,
    compareRemote = false,
  ): Promise<Record<string, string>> {
    const { productId, priceId } = ids(current, mode);
    if (!productId) {
      // An archived plan never sold in this mode has nothing to create there.
      if (!next.active) return {};
      return this.createProduct(client, mode, current.id, next);
    }

    await client.products.update(productId, {
      name: next.name,
      description: next.description ?? '',
      active: next.active,
    });

    // A Stripe price is immutable: a new amount or interval means a new price.
    let stale =
      !priceId ||
      current.amountCents !== next.amountCents ||
      current.interval !== next.interval;
    if (!stale && compareRemote && priceId) {
      const price = await client.prices.retrieve(priceId);
      stale =
        price.unit_amount !== next.amountCents ||
        price.recurring?.interval !== STRIPE_INTERVAL[next.interval];
    }
    if (stale) {
      const newPriceId = await this.createPrice(
        client,
        productId,
        current.id,
        next,
      );
      if (priceId && priceId !== newPriceId) {
        await client.prices.update(priceId, { active: false });
      }
      return { [MODE_FIELDS[mode].price]: newPriceId };
    }
    if (priceId) {
      await client.prices.update(priceId, { active: next.active });
    }
    return {};
  }

  private async createProduct(
    client: Stripe,
    mode: StripeMode,
    planId: string,
    plan: PlanShape,
  ): Promise<Record<string, string>> {
    const product = await client.products.create(
      {
        name: plan.name,
        ...(plan.description && { description: plan.description }),
        active: plan.active,
        metadata: { planId },
      },
      { idempotencyKey: `plan-product-${mode}-${planId}` },
    );
    const priceId = await this.createPrice(client, product.id, planId, plan);
    return {
      [MODE_FIELDS[mode].product]: product.id,
      [MODE_FIELDS[mode].price]: priceId,
    };
  }

  private async createPrice(
    client: Stripe,
    productId: string,
    planId: string,
    plan: PlanShape,
  ): Promise<string> {
    const price = await client.prices.create(
      {
        product: productId,
        unit_amount: plan.amountCents,
        currency: plan.currency,
        recurring: { interval: STRIPE_INTERVAL[plan.interval] },
        active: plan.active,
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
