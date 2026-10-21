import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanupTestUsers,
  createTestApp,
  registerUser,
  TEST_PASSWORD,
  testEmail,
} from './utils';

describe('Admin accounts, roles and Stripe mode (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let admin: Awaited<ReturnType<typeof registerUser>>;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    admin = await registerUser(app);
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'ADMIN' },
    });
  });

  afterAll(async () => {
    await prisma.appSettings.update({
      where: { id: 1 },
      data: { stripeLive: false },
    });
    await cleanupTestUsers(app);
    await app.close();
  });

  it('changes a role only with the admin password, journals it, and never on oneself', async () => {
    const member = await registerUser(app);
    const server = app.getHttpServer();
    const route = `/admin/members/${member.id}/role`;

    await request(server)
      .patch(route)
      .set('Cookie', member.cookie)
      .send({ role: 'ADMIN', password: TEST_PASSWORD })
      .expect(403);
    const wrong = await request(server)
      .patch(route)
      .set('Cookie', admin.cookie)
      .send({ role: 'ADMIN', password: 'not-my-password' })
      .expect(403);
    expect(wrong.body).toMatchObject({ code: 'password_confirmation_failed' });

    const promoted = await request(server)
      .patch(route)
      .set('Cookie', admin.cookie)
      .send({ role: 'ADMIN', password: TEST_PASSWORD })
      .expect(200);
    expect(promoted.body).toMatchObject({
      role: 'ADMIN',
      roleChanges: [{ fromRole: 'PRACTITIONER', toRole: 'ADMIN' }],
    });
    // The promoted member reaches admin routes at once: the role is re-read per request.
    await request(server)
      .get('/admin/members')
      .set('Cookie', member.cookie)
      .expect(200);

    await request(server)
      .patch(`/admin/members/${admin.id}/role`)
      .set('Cookie', admin.cookie)
      .send({ role: 'PRACTITIONER', password: TEST_PASSWORD })
      .expect(400);

    await request(server)
      .patch(route)
      .set('Cookie', admin.cookie)
      .send({ role: 'PRACTITIONER', password: TEST_PASSWORD })
      .expect(200);
    await request(server)
      .get('/admin/members')
      .set('Cookie', member.cookie)
      .expect(403);
    expect(
      await prisma.roleChange.count({ where: { userId: member.id } }),
    ).toBe(2);
  });

  it('creates a complete account whose temporary password must be replaced first', async () => {
    const server = app.getHttpServer();
    const email = testEmail();
    const temporary = 'provisoire-2026';
    await request(server)
      .post('/admin/members')
      .set('Cookie', admin.cookie)
      .send({
        firstName: 'Hana',
        lastName: 'Mori',
        email,
        temporaryPassword: 'court',
      })
      .expect(400);
    const created = await request(server)
      .post('/admin/members')
      .set('Cookie', admin.cookie)
      .send({
        firstName: 'Hana',
        lastName: 'Mori',
        email,
        temporaryPassword: temporary,
      })
      .expect(201);
    expect(created.body).toMatchObject({
      user: { email, mustChangePassword: true, termsAcceptedAt: null },
    });
    await request(server)
      .post('/admin/members')
      .set('Cookie', admin.cookie)
      .send({
        firstName: 'Hana',
        lastName: 'Mori',
        email,
        temporaryPassword: temporary,
      })
      .expect(409);

    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: temporary })
      .expect(200);
    expect(login.body).toMatchObject({ mustChangePassword: true });
    const cookie = login.get('Set-Cookie')?.[0]?.split(';')[0] ?? '';

    await request(server).get('/auth/me').set('Cookie', cookie).expect(200);
    const blocked = await request(server)
      .get('/members')
      .set('Cookie', cookie)
      .expect(403);
    expect(blocked.body).toMatchObject({ code: 'password_change_required' });

    const password = (body: object) =>
      request(server).post('/auth/password').set('Cookie', cookie).send(body);
    await password({
      currentPassword: temporary,
      newPassword: temporary,
      acceptTerms: true,
    }).expect(400);
    await password({
      currentPassword: temporary,
      newPassword: 'mon-mot-de-passe',
    }).expect(400);
    await password({
      currentPassword: temporary,
      newPassword: 'mon-mot-de-passe',
      acceptTerms: true,
    }).expect(204);

    await request(server).get('/members').set('Cookie', cookie).expect(200);
    const me = await request(server)
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(me.body).toMatchObject({ mustChangePassword: false });
    expect(
      (me.body as { termsAcceptedAt: string | null }).termsAcceptedAt,
    ).not.toBeNull();
  });

  it('switches Stripe mode only to a configured mode, with the admin password', async () => {
    const server = app.getHttpServer();
    const member = await registerUser(app);
    await request(server)
      .get('/admin/settings/billing')
      .set('Cookie', member.cookie)
      .expect(403);

    const settings = await request(server)
      .get('/admin/settings/billing')
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(settings.body).toMatchObject({
      mode: 'test',
      configured: { live: false },
    });

    await request(server)
      .put('/admin/settings/billing')
      .set('Cookie', admin.cookie)
      .send({ mode: 'live', password: 'nope-nope-nope' })
      .expect(403);
    const refused = await request(server)
      .put('/admin/settings/billing')
      .set('Cookie', admin.cookie)
      .send({ mode: 'live', password: TEST_PASSWORD })
      .expect(409);
    expect(refused.body).toMatchObject({ code: 'stripe_mode_unavailable' });
  });

  it('counts only the subscriptions of the current mode', async () => {
    const member = await registerUser(app);
    await prisma.subscription.create({
      data: {
        userId: member.id,
        stripeSubscriptionId: `sub_live_${member.id}`,
        status: 'active',
        livemode: true,
      },
    });
    const server = app.getHttpServer();
    const test = await request(server)
      .get('/billing/subscription')
      .set('Cookie', member.cookie)
      .expect(200);
    expect(test.body).toMatchObject({ isMember: false, status: null });

    await prisma.appSettings.update({
      where: { id: 1 },
      data: { stripeLive: true },
    });
    const live = await request(server)
      .get('/billing/subscription')
      .set('Cookie', member.cookie)
      .expect(200);
    expect(live.body).toMatchObject({ isMember: true, status: 'active' });
    await prisma.appSettings.update({
      where: { id: 1 },
      data: { stripeLive: false },
    });
  });
});
