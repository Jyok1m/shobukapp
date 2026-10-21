import { PlansService } from './plans.service';
import { UpdatePlanDto } from './dto/plan.dto';

const plan = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Annuel',
  description: null,
  amountCents: 25000,
  currency: 'eur',
  interval: 'YEAR' as const,
  stripeTestProductId: 'prod_1',
  stripeTestPriceId: 'price_old',
  stripeLiveProductId: null,
  stripeLivePriceId: null,
  active: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setup() {
  const stripe = {
    products: { create: jest.fn(), update: jest.fn() },
    prices: {
      create: jest.fn().mockResolvedValue({ id: 'price_new' }),
      update: jest.fn(),
    },
  };
  const prisma = {
    plan: {
      findUnique: jest.fn().mockResolvedValue(plan),
      update: jest.fn().mockImplementation(({ data }: { data: object }) => ({
        ...plan,
        ...data,
      })),
    },
  };
  const service = new PlansService(
    prisma as never,
    {
      current: () => Promise.resolve({ mode: 'test', client: stripe }),
      require: () => stripe,
    } as never,
  );
  return { service, stripe, prisma };
}

// Mirrors what ValidationPipe hands over: every declared field, undefined when absent.
function dto(values: Partial<UpdatePlanDto>): UpdatePlanDto {
  return Object.assign(new UpdatePlanDto(), {
    name: undefined,
    description: undefined,
    amountCents: undefined,
    interval: undefined,
    sortOrder: undefined,
    active: undefined,
    ...values,
  });
}

describe('PlansService.syncAllForMode', () => {
  it('creates missing live objects, skips archived plans, and replaces a drifted price', async () => {
    const live = {
      products: {
        create: jest.fn().mockResolvedValue({ id: 'prod_live' }),
        update: jest.fn(),
      },
      prices: {
        create: jest.fn().mockResolvedValue({ id: 'price_live_new' }),
        update: jest.fn(),
        retrieve: jest.fn().mockResolvedValue({
          unit_amount: 20000,
          recurring: { interval: 'year' },
        }),
      },
    };
    const neverSold = { ...plan, id: 'p1' };
    const archived = { ...plan, id: 'p2', active: false };
    const drifted = {
      ...plan,
      id: 'p3',
      stripeLiveProductId: 'prod_x',
      stripeLivePriceId: 'price_x',
    };
    const prisma = {
      plan: {
        findMany: jest.fn().mockResolvedValue([neverSold, archived, drifted]),
        update: jest.fn(),
      },
    };
    const service = new PlansService(
      prisma as never,
      { require: () => live } as never,
    );
    await service.syncAllForMode('live');

    expect(live.products.create).toHaveBeenCalledTimes(1);
    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        stripeLiveProductId: 'prod_live',
        stripeLivePriceId: 'price_live_new',
      },
    });
    expect(prisma.plan.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p2' } }),
    );
    expect(live.prices.update).toHaveBeenCalledWith('price_x', {
      active: false,
    });
    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: 'p3' },
      data: { stripeLivePriceId: 'price_live_new' },
    });
  });
});

describe('PlansService.update', () => {
  it('creates a recurring price with the current interval and deactivates the old one', async () => {
    const { service, stripe, prisma } = setup();
    await service.update(plan.id, dto({ amountCents: 30000 }));

    expect(stripe.prices.create).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'prod_1',
        unit_amount: 30000,
        recurring: { interval: 'year' },
      }),
      expect.anything(),
    );
    expect(stripe.prices.update).toHaveBeenCalledWith('price_old', {
      active: false,
    });
    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: plan.id },
      data: { amountCents: 30000, stripeTestPriceId: 'price_new' },
    });
    // The product is re-sent as the row describes it, unchanged here.
    expect(stripe.products.update).toHaveBeenCalledWith(
      'prod_1',
      expect.objectContaining({ name: 'Annuel', active: true }),
    );
  });

  it('renames the product without touching the price', async () => {
    const { service, stripe } = setup();
    await service.update(plan.id, dto({ name: 'Annuel adulte' }));
    expect(stripe.products.update).toHaveBeenCalledWith(
      'prod_1',
      expect.objectContaining({ name: 'Annuel adulte', active: true }),
    );
    expect(stripe.prices.create).not.toHaveBeenCalled();
  });

  it('archives product and price together', async () => {
    const { service, stripe } = setup();
    await service.archive(plan.id);
    expect(stripe.products.update).toHaveBeenCalledWith(
      'prod_1',
      expect.objectContaining({ active: false }),
    );
    expect(stripe.prices.update).toHaveBeenCalledWith('price_old', {
      active: false,
    });
  });
});
