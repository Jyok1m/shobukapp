import { PlansService } from './plans.service';
import { UpdatePlanDto } from './dto/plan.dto';

const plan = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Annuel',
  description: null,
  amountCents: 25000,
  currency: 'eur',
  interval: 'YEAR' as const,
  stripeProductId: 'prod_1',
  stripePriceId: 'price_old',
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
    { enabled: true, require: () => stripe } as never,
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
      data: { amountCents: 30000, stripePriceId: 'price_new' },
    });
    expect(stripe.products.update).not.toHaveBeenCalled();
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
