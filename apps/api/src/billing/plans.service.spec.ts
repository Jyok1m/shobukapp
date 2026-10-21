import { BadRequestException } from '@nestjs/common';
import { frequencyOf, PlansService } from './plans.service';

const PLAN_ID = '11111111-1111-4111-8111-111111111111';

function price(
  frequency: 'YEAR' | 'QUARTER' | 'MONTH',
  amountCents: number,
  ids: { test?: string; live?: string } = {},
  active = true,
) {
  return {
    id: `${frequency}-id`,
    planId: PLAN_ID,
    frequency,
    amountCents,
    active,
    stripeTestPriceId: ids.test ?? null,
    stripeLivePriceId: ids.live ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function plan(overrides: object = {}) {
  return {
    id: PLAN_ID,
    name: 'Adulte',
    description: null,
    currency: 'eur',
    stripeTestProductId: 'prod_1',
    stripeLiveProductId: null,
    active: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    prices: [price('YEAR', 25000, { test: 'price_year' })],
    ...overrides,
  };
}

function stripeMock() {
  return {
    products: {
      create: jest.fn().mockResolvedValue({ id: 'prod_new' }),
      update: jest.fn(),
    },
    prices: {
      create: jest.fn().mockResolvedValue({ id: 'price_new' }),
      update: jest.fn(),
      retrieve: jest.fn(),
    },
  };
}

function setup(
  current: ReturnType<typeof plan>,
  mode: 'test' | 'live' = 'test',
) {
  const stripe = stripeMock();
  const saved: unknown[] = [];
  const tx = {
    plan: {
      update: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue(current),
    },
    planPrice: {
      upsert: jest.fn().mockImplementation((args: unknown) => saved.push(args)),
    },
  };
  const prisma = {
    plan: {
      findUnique: jest.fn().mockResolvedValue(current),
      findMany: jest.fn().mockResolvedValue([current]),
    },
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
  };
  const service = new PlansService(
    prisma as never,
    {
      current: () => Promise.resolve({ mode, client: stripe }),
      require: () => stripe,
    } as never,
  );
  return { service, stripe, saved };
}

describe('frequencyOf', () => {
  it('reads a quarterly price as a monthly one billed every three months', () => {
    expect(frequencyOf({ interval: 'month', interval_count: 3 })).toBe(
      'QUARTER',
    );
    expect(frequencyOf({ interval: 'month', interval_count: 1 })).toBe('MONTH');
    expect(frequencyOf({ interval: 'year', interval_count: 1 })).toBe('YEAR');
    expect(frequencyOf({ interval: 'week', interval_count: 1 })).toBeNull();
  });
});

describe('PlansService.update', () => {
  it('adds a quarterly price as a Stripe price every 3 months', async () => {
    const { service, stripe, saved } = setup(plan());
    await service.update(PLAN_ID, {
      prices: [{ frequency: 'QUARTER', amountCents: 7000, active: true }],
    });
    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'prod_1',
        unit_amount: 7000,
        recurring: { interval: 'month', interval_count: 3 },
      }),
      expect.anything(),
    );
    expect(saved).toContainEqual(
      expect.objectContaining({
        create: expect.objectContaining({
          frequency: 'QUARTER',
          stripeTestPriceId: 'price_new',
        }) as unknown,
      }),
    );
  });

  it('replaces the price of a frequency whose amount changed', async () => {
    const { service, stripe } = setup(plan());
    await service.update(PLAN_ID, {
      prices: [{ frequency: 'YEAR', amountCents: 27000, active: true }],
    });
    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({ unit_amount: 27000 }),
      expect.anything(),
    );
    expect(stripe.prices.update).toHaveBeenCalledWith('price_year', {
      active: false,
    });
  });

  it('drops the price of a frequency changed while not offered', async () => {
    const current = plan({
      prices: [
        price('YEAR', 25000, { test: 'price_year' }),
        price('MONTH', 2500, { test: 'price_month' }, false),
      ],
    });
    const { service, stripe, saved } = setup(current);
    await service.update(PLAN_ID, {
      prices: [{ frequency: 'MONTH', amountCents: 3000, active: false }],
    });
    expect(stripe.prices.create).not.toHaveBeenCalled();
    expect(stripe.prices.update).toHaveBeenCalledWith('price_month', {
      active: false,
    });
    expect(saved).toContainEqual(
      expect.objectContaining({
        update: expect.objectContaining({
          amountCents: 3000,
          stripeTestPriceId: null,
        }) as unknown,
      }),
    );
  });

  it('refuses a plan left with no frequency offered', async () => {
    const { service } = setup(plan());
    await expect(
      service.update(PLAN_ID, {
        prices: [{ frequency: 'YEAR', amountCents: 25000, active: false }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('archives product and prices together', async () => {
    const { service, stripe } = setup(plan());
    await service.archive(PLAN_ID);
    expect(stripe.products.update).toHaveBeenCalledWith(
      'prod_1',
      expect.objectContaining({ active: false }),
    );
    expect(stripe.prices.update).toHaveBeenCalledWith('price_year', {
      active: false,
    });
  });
});

describe('PlansService.syncAllForMode', () => {
  it('creates the live product and prices of a plan never sold live', async () => {
    const { service, stripe, saved } = setup(plan(), 'live');
    await service.syncAllForMode('live');
    expect(stripe.products.create).toHaveBeenCalledTimes(1);
    expect(saved).toContainEqual(
      expect.objectContaining({
        update: expect.objectContaining({
          stripeLivePriceId: 'price_new',
        }) as unknown,
      }),
    );
  });

  it('replaces a live price whose amount drifted at Stripe', async () => {
    const current = plan({
      stripeLiveProductId: 'prod_live',
      prices: [price('YEAR', 25000, { live: 'price_live' })],
    });
    const { service, stripe } = setup(current, 'live');
    stripe.prices.retrieve.mockResolvedValue({
      unit_amount: 20000,
      recurring: { interval: 'year', interval_count: 1 },
    });
    await service.syncAllForMode('live');
    expect(stripe.prices.update).toHaveBeenCalledWith('price_live', {
      active: false,
    });
    expect(stripe.prices.create).toHaveBeenCalled();
  });

  it('creates nothing for an archived plan never sold in this mode', async () => {
    const { service, stripe } = setup(plan({ active: false }), 'live');
    await service.syncAllForMode('live');
    expect(stripe.products.create).not.toHaveBeenCalled();
    expect(stripe.prices.create).not.toHaveBeenCalled();
  });
});
