import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestUsers, createTestApp, registerUser } from './utils';

const WEBHOOK_SECRET = 'whsec_e2e_test_secret';

function signed(payload: object) {
  const body = JSON.stringify(payload);
  const header = new Stripe('sk_test_unused').webhooks.generateTestHeaderString(
    {
      payload: body,
      secret: WEBHOOK_SECRET,
    },
  );
  return { body, header };
}

describe('Billing (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    // CI has no Stripe key: signature checks need a client, never the network.
    process.env.STRIPE_TEST_SECRET_KEY ||= 'sk_test_ci_placeholder';
    process.env.STRIPE_TEST_WEBHOOK_SECRET = WEBHOOK_SECRET;
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.close();
  });

  it('rejects a checkout without a valid frequency', async () => {
    const { cookie } = await registerUser(app);
    await request(app.getHttpServer())
      .post('/billing/checkout')
      .set('Cookie', cookie)
      .send({ planId: randomUUID(), frequency: 'WEEK' })
      .expect(400);
  });

  it('serves the plans publicly, without Stripe identifiers', async () => {
    const res = await request(app.getHttpServer())
      .get('/billing/plans')
      .expect(200);
    for (const plan of res.body as Record<string, unknown>[]) {
      expect(JSON.stringify(plan)).not.toMatch(/stripe/i);
      expect(plan).toHaveProperty('prices.0.purchasable');
    }
  });

  it('guards every /admin/plans route: 401 for a visitor, 403 for a practitioner', async () => {
    const { cookie } = await registerUser(app);
    const server = app.getHttpServer();
    const id = randomUUID();
    const routes = [
      () => request(server).get('/admin/plans'),
      () => request(server).post('/admin/plans').send({}),
      () => request(server).patch(`/admin/plans/${id}`).send({}),
      () => request(server).delete(`/admin/plans/${id}`),
    ];
    for (const route of routes) {
      await route().expect(401);
      await route().set('Cookie', cookie).expect(403);
    }
  });

  it('validates plan input for an admin', async () => {
    const admin = await registerUser(app);
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'ADMIN' },
    });
    const server = app.getHttpServer();

    await request(server)
      .get('/admin/plans')
      .set('Cookie', admin.cookie)
      .expect(200);
    await request(server)
      .post('/admin/plans')
      .set('Cookie', admin.cookie)
      .send({
        name: 'Trop bas',
        prices: [{ frequency: 'YEAR', amountCents: 10, active: true }],
      })
      .expect(400);
    await request(server)
      .post('/admin/plans')
      .set('Cookie', admin.cookie)
      .send({
        name: 'Intervalle',
        prices: [{ frequency: 'WEEK', amountCents: 1000, active: true }],
      })
      .expect(400);
    await request(server)
      .post('/admin/plans')
      .set('Cookie', admin.cookie)
      .send({
        name: 'Doublon',
        prices: [
          { frequency: 'YEAR', amountCents: 1000, active: true },
          { frequency: 'YEAR', amountCents: 2000, active: true },
        ],
      })
      .expect(400);
    await request(server)
      .post('/admin/plans')
      .set('Cookie', admin.cookie)
      .send({
        name: 'Rien de propose',
        prices: [{ frequency: 'MONTH', amountCents: 1000, active: false }],
      })
      .expect(400);
    await request(server)
      .patch(`/admin/plans/${randomUUID()}`)
      .set('Cookie', admin.cookie)
      .send({ stripePriceId: 'price_x' })
      .expect(400);
  });

  it('refuses a webhook with a bad or missing signature', async () => {
    const server = app.getHttpServer();
    const { body } = signed({ id: 'evt_bad', type: 'invoice.paid' });
    await request(server)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(400);
    await request(server)
      .post('/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 't=1,v1=forged')
      .send(body)
      .expect(400);
  });

  it('records a paid invoice once, even when Stripe replays the event', async () => {
    const { id: userId } = await registerUser(app);
    const customerId = `cus_e2e_${randomUUID()}`;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeTestCustomerId: customerId },
    });
    const invoiceId = `in_e2e_${randomUUID()}`;
    const eventId = `evt_e2e_${randomUUID()}`;
    const { body, header } = signed({
      id: eventId,
      object: 'event',
      type: 'invoice.paid',
      data: {
        object: {
          id: invoiceId,
          object: 'invoice',
          customer: customerId,
          amount_paid: 25000,
          amount_due: 25000,
          currency: 'eur',
          status_transitions: { paid_at: 1_760_000_000 },
          parent: null,
          livemode: false,
        },
      },
    });

    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .post('/billing/webhook')
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', header)
        .send(body)
        .expect(200);
    }

    const payments = await prisma.payment.findMany({
      where: { stripeInvoiceId: invoiceId },
    });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      userId,
      amountCents: 25000,
      status: 'PAID',
    });
    expect(await prisma.stripeEvent.count({ where: { id: eventId } })).toBe(1);
    await prisma.stripeEvent.delete({ where: { id: eventId } });
  });

  it('shows the membership of the current user', async () => {
    const { cookie } = await registerUser(app);
    const res = await request(app.getHttpServer())
      .get('/billing/subscription')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body).toMatchObject({
      isMember: false,
      status: null,
      payments: [],
    });
  });
});
