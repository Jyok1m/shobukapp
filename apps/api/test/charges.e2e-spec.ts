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
    { payload: body, secret: WEBHOOK_SECRET },
  );
  return { body, header };
}

describe('One-off charges (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let productId: string;

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_TEST_SECRET_KEY ||= 'sk_test_ci_placeholder';
    process.env.STRIPE_TEST_WEBHOOK_SECRET = WEBHOOK_SECRET;
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const product = await prisma.product.create({
      data: {
        slug: `e2e-${randomUUID()}`,
        name: 'Licence e2e',
        kind: 'FEDERATION',
        amountCents: 5600,
        perSeason: true,
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await prisma.product.delete({ where: { id: productId } });
    await app.close();
  });

  async function admin() {
    const user = await registerUser(app);
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    });
    return user;
  }

  it('guards every admin product and charge route', async () => {
    const { cookie } = await registerUser(app);
    const server = app.getHttpServer();
    const id = randomUUID();
    const routes = [
      () => request(server).get('/admin/products'),
      () => request(server).patch(`/admin/products/${id}`).send({}),
      () => request(server).get(`/admin/members/${id}/charges`),
      () => request(server).post(`/admin/members/${id}/charges`).send({}),
      () => request(server).post(`/admin/charges/${id}/link`),
      () => request(server).patch(`/admin/charges/${id}`).send({}),
    ];
    for (const route of routes) {
      await route().expect(401);
      await route().set('Cookie', cookie).expect(403);
    }
  });

  it('records a charge once per season and lets the bureau settle it by hand', async () => {
    const { cookie } = await admin();
    const member = await registerUser(app);
    const server = app.getHttpServer();

    const created = await request(server)
      .post(`/admin/members/${member.id}/charges`)
      .set('Cookie', cookie)
      .send({ productId, sendLink: false })
      .expect(201);
    expect(created.body).toMatchObject({
      status: 'PENDING',
      amountCents: 5600,
    });

    await request(server)
      .post(`/admin/members/${member.id}/charges`)
      .set('Cookie', cookie)
      .send({ productId, sendLink: false })
      .expect(409);

    await request(server)
      .patch(`/admin/charges/${(created.body as { id: string }).id}`)
      .set('Cookie', cookie)
      .send({ status: 'PAID' })
      .expect(200)
      .expect((res) =>
        expect(res.body).toMatchObject({ status: 'PAID', method: 'MANUAL' }),
      );

    const mine = await request(server)
      .get('/billing/charges')
      .set('Cookie', member.cookie)
      .expect(200);
    expect(mine.body).toEqual([
      expect.objectContaining({ status: 'PAID', stripePaymentLinkUrl: null }),
    ]);
  });

  it('marks a charge paid from the payment link webhook, once', async () => {
    const member = await registerUser(app);
    const linkId = `plink_e2e_${randomUUID()}`;
    const charge = await prisma.charge.create({
      data: {
        userId: member.id,
        productId,
        amountCents: 5600,
        stripePaymentLinkId: linkId,
        stripePaymentLinkUrl: 'https://buy.stripe.com/test_e2e',
      },
    });
    const eventId = `evt_e2e_${randomUUID()}`;
    const { body, header } = signed({
      id: eventId,
      object: 'event',
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: `cs_e2e_${randomUUID()}`,
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'paid',
          payment_link: linkId,
          metadata: {},
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
    expect(
      await prisma.charge.findUniqueOrThrow({ where: { id: charge.id } }),
    ).toMatchObject({ status: 'PAID', method: 'STRIPE' });
    await prisma.stripeEvent.delete({ where: { id: eventId } });
  });
});
