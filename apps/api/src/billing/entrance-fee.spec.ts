import { SubscriptionsService } from './subscriptions.service';

const DAY = 24 * 3600 * 1000;

function setup(sub: object | null) {
  const stripe = { invoiceItems: { create: jest.fn() } };
  const prisma = {
    subscription: {
      findUnique: jest.fn().mockResolvedValue(sub),
      update: jest.fn(),
    },
  };
  const service = new SubscriptionsService(
    prisma as never,
    { require: () => stripe } as never,
    { send: jest.fn() } as never,
    { getOrThrow: () => 'http://localhost:3000' } as never,
  );
  return { service, stripe, prisma };
}

const invoice = (overrides: object = {}) =>
  ({
    id: 'in_1',
    customer: 'cus_1',
    status: 'draft',
    billing_reason: 'subscription_cycle',
    parent: { subscription_details: { subscription: 'sub_1' } },
    ...overrides,
  }) as never;

const subscription = (dueAt: Date | null, entranceFeeCents = 6000) => ({
  id: 'sub-local',
  entranceFeeDueAt: dueAt,
  plan: { entranceFeeCents, currency: 'eur' },
});

describe('SubscriptionsService.addEntranceFee', () => {
  it('adds the fee to a renewal draft once due, then moves the date a year on', async () => {
    const due = new Date(Date.now() - DAY);
    const { service, stripe, prisma } = setup(subscription(due));
    await service.addEntranceFee(invoice(), 'test');
    expect(stripe.invoiceItems.create).toHaveBeenCalledWith(
      expect.objectContaining({ invoice: 'in_1', amount: 6000 }),
      { idempotencyKey: 'entrance-in_1' },
    );
    const next = new Date(due);
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-local' },
      data: { entranceFeeDueAt: next },
    });
  });

  it('lands in the future even when long overdue', async () => {
    const { service, prisma } = setup(
      subscription(new Date(Date.now() - 800 * DAY)),
    );
    await service.addEntranceFee(invoice(), 'test');
    const [[args]] = prisma.subscription.update.mock.calls as [
      [{ data: { entranceFeeDueAt: Date } }],
    ];
    expect(args.data.entranceFeeDueAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('ignores a first invoice, a finalized one and a fee not yet due', async () => {
    const early = setup(subscription(new Date(Date.now() + 30 * DAY)));
    await early.service.addEntranceFee(invoice(), 'test');
    const first = setup(subscription(new Date(Date.now() - DAY)));
    await first.service.addEntranceFee(
      invoice({ billing_reason: 'subscription_create' }),
      'test',
    );
    await first.service.addEntranceFee(invoice({ status: 'open' }), 'test');
    for (const { stripe } of [early, first]) {
      expect(stripe.invoiceItems.create).not.toHaveBeenCalled();
    }
  });

  it('charges nothing on a plan without entrance fee', async () => {
    const { service, stripe } = setup(
      subscription(new Date(Date.now() - DAY), 0),
    );
    await service.addEntranceFee(invoice(), 'test');
    expect(stripe.invoiceItems.create).not.toHaveBeenCalled();
  });
});
