import { pickCurrent, SubscriptionsService } from './subscriptions.service';

const day = (n: number) => new Date(2026, 0, n);

describe('pickCurrent', () => {
  it('prefers a live subscription over a more recent canceled one', () => {
    const subs = [
      { id: 'b', status: 'active', createdAt: day(2) },
      { id: 'a', status: 'canceled', createdAt: day(1) },
      { id: 'c', status: 'canceled', createdAt: day(3) },
    ];
    expect(pickCurrent(subs)?.id).toBe('b');
  });

  it('falls back to the most recently created one', () => {
    const subs = [
      { id: 'a', status: 'canceled', createdAt: day(1) },
      { id: 'b', status: 'incomplete_expired', createdAt: day(2) },
    ];
    expect(pickCurrent(subs)?.id).toBe('b');
    expect(pickCurrent([])).toBeNull();
  });
});

function setup(subscription: object) {
  const stripe = {
    subscriptions: { retrieve: jest.fn().mockResolvedValue(subscription) },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    plan: { findUnique: jest.fn() },
    subscription: { upsert: jest.fn() },
    payment: { upsert: jest.fn() },
  };
  const service = new SubscriptionsService(
    prisma as never,
    { require: () => stripe } as never,
    { getOrThrow: () => 'http://localhost:3000' } as never,
  );
  return { service, prisma };
}

const stripeSubscription = (product: string) => ({
  id: 'sub_1',
  customer: 'cus_1',
  status: 'active',
  cancel_at_period_end: false,
  metadata: {},
  items: {
    data: [
      {
        current_period_end: 1_800_000_000,
        price: { id: 'price_old', product },
      },
    ],
  },
});

describe('SubscriptionsService.syncFromStripe', () => {
  it('matches the plan by product, so a subscriber on an old price keeps their plan', async () => {
    const { service, prisma } = setup(stripeSubscription('prod_1'));
    prisma.plan.findUnique.mockResolvedValue({ id: 'plan-1' });
    await service.syncFromStripe('sub_1');

    expect(prisma.plan.findUnique).toHaveBeenCalledWith({
      where: { stripeProductId: 'prod_1' },
      select: { id: true },
    });
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          planId: 'plan-1',
          status: 'active',
          currentPeriodEnd: new Date(1_800_000_000 * 1000),
        }) as unknown,
      }),
    );
  });

  it('stores an unknown product without a plan instead of guessing', async () => {
    const { service, prisma } = setup(stripeSubscription('prod_unknown'));
    prisma.plan.findUnique.mockResolvedValue(null);
    await service.syncFromStripe('sub_1');
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ planId: null }) as unknown,
      }),
    );
  });
});

describe('SubscriptionsService.recordInvoice', () => {
  it('never lets a late failure notice overwrite a paid invoice', async () => {
    const { service, prisma } = setup(stripeSubscription('prod_1'));
    await service.recordInvoice(
      {
        id: 'in_1',
        customer: 'cus_1',
        amount_paid: 0,
        amount_due: 2500,
        currency: 'eur',
        status_transitions: { paid_at: null },
        parent: null,
      } as never,
      'FAILED',
    );
    expect(prisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });
});
