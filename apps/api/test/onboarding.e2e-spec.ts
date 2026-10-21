import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanupTestUsers,
  createLinkInvitation,
  createTestApp,
  registerUser,
  TEST_PASSWORD,
  testEmail,
} from './utils';

const signup = (extra: object) => ({
  password: TEST_PASSWORD,
  firstName: 'Kenji',
  lastName: 'Tanaka',
  acceptTerms: true,
  ...extra,
});

describe('Onboarding (e2e)', () => {
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
    await cleanupTestUsers(app);
    await app.close();
  });

  it('refuses any signup without an invitation', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/auth/register')
      .send(signup({ email: testEmail() }))
      .expect(400);
    const res = await request(server)
      .post('/auth/register')
      .send(signup({ token: 'x'.repeat(43) }))
      .expect(400);
    expect(res.body).toMatchObject({ code: 'invalid_invitation' });
  });

  it('takes a join request, lets an admin send a link, and the link creates one account', async () => {
    const server = app.getHttpServer();
    const email = testEmail();
    await request(server)
      .post('/join-requests')
      .send({
        firstName: 'Kenji',
        lastName: 'Tanaka',
        email,
        message: 'Bonjour, je voudrais découvrir le kendo à la rentrée.',
        wantsTrial: true,
        acceptPrivacy: true,
      })
      .expect(202);

    const list = await request(server)
      .get('/admin/join-requests')
      .query({ status: 'NEW' })
      .set('Cookie', admin.cookie)
      .expect(200);
    const request_ = (
      list.body as {
        items: { id: string; email: string; wantsTrial: boolean }[];
      }
    ).items.find((item) => item.email === email);
    expect(request_).toMatchObject({ wantsTrial: true });

    const invited = await request(server)
      .post(`/admin/join-requests/${request_!.id}/invite`)
      .set('Cookie', admin.cookie)
      .expect(201);
    const { link } = invited.body as { link: string };
    const token = new URL(link).searchParams.get('invitation')!;

    const preview = await request(server)
      .get(`/auth/invitations/${token}`)
      .expect(200);
    expect(preview.body).toMatchObject({ email, firstName: 'Kenji' });

    // The email comes from the invitation, never from the form.
    await request(server)
      .post('/auth/register')
      .send(signup({ token, email: 'someone.else@e2e.shobukapp.test' }))
      .expect(400);
    const ok = await request(server)
      .post('/auth/register')
      .send(signup({ token }))
      .expect(201);
    expect(ok.body).toMatchObject({ email, role: 'PRACTITIONER' });

    await request(server)
      .post('/auth/register')
      .send(signup({ token }))
      .expect(400);
    await request(server).get(`/auth/invitations/${token}`).expect(404);

    const after = await request(server)
      .get(`/admin/join-requests/${request_!.id}`)
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(after.body).toMatchObject({
      status: 'INVITED',
      invitation: { status: 'USED' },
    });
  });

  it('drops honeypot submissions silently', async () => {
    const email = testEmail();
    await request(app.getHttpServer())
      .post('/join-requests')
      .send({
        firstName: 'Bot',
        lastName: 'Bot',
        email,
        message: 'Buy cheap things now please',
        wantsTrial: false,
        acceptPrivacy: true,
        website: 'http://spam.example',
      })
      .expect(202);
    expect(await prisma.joinRequest.count({ where: { email } })).toBe(0);
  });

  it('lets an existing practitioner activate with an email and a code, and locks after five wrong codes', async () => {
    const server = app.getHttpServer();
    const email = testEmail();
    const created = await request(server)
      .post('/admin/invitations')
      .set('Cookie', admin.cookie)
      .send({ firstName: 'Yuki', lastName: 'Sato', email })
      .expect(201);
    const { code } = created.body as { code: string };
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);

    await request(server)
      .post('/auth/register')
      .send(signup({ email: testEmail(), code }))
      .expect(400);
    const ok = await request(server)
      .post('/auth/register')
      .send(
        signup({
          email: email.toUpperCase(),
          code: code.toLowerCase().replace('-', ' '),
        }),
      )
      .expect(201);
    expect(ok.body).toMatchObject({ email });

    const locked = testEmail();
    const second = await request(server)
      .post('/admin/invitations')
      .set('Cookie', admin.cookie)
      .send({ firstName: 'Ren', lastName: 'Ito', email: locked })
      .expect(201);
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/auth/register')
        .send(signup({ email: locked, code: 'AAAA-AAAA' }))
        .expect(400);
    }
    await request(server)
      .post('/auth/register')
      .send(
        signup({ email: locked, code: (second.body as { code: string }).code }),
      )
      .expect(400);
  });

  it('refuses an expired link and an invitation for an existing account', async () => {
    const server = app.getHttpServer();
    const { token } = await createLinkInvitation(app, testEmail(), {
      expiresAt: new Date(Date.now() - 1000),
    });
    await request(server)
      .post('/auth/register')
      .send(signup({ token }))
      .expect(400);

    const member = await registerUser(app);
    await request(server)
      .post('/admin/invitations')
      .set('Cookie', admin.cookie)
      .send({ firstName: 'Déjà', lastName: 'Membre', email: member.email })
      .expect(409);
  });

  it('throttles link previews per token, not for everyone at once', async () => {
    const server = app.getHttpServer();
    const hammered = 'y'.repeat(43);
    for (let i = 0; i < 20; i++) {
      await request(server).get(`/auth/invitations/${hammered}`).expect(404);
    }
    await request(server).get(`/auth/invitations/${hammered}`).expect(429);
    const { token } = await createLinkInvitation(app);
    await request(server).get(`/auth/invitations/${token}`).expect(200);
  });

  it('guards every admin onboarding route', async () => {
    const practitioner = await registerUser(app);
    const server = app.getHttpServer();
    const id = randomUUID();
    const routes = [
      () => request(server).get('/admin/join-requests'),
      () => request(server).get('/admin/join-requests/count'),
      () => request(server).get(`/admin/join-requests/${id}`),
      () =>
        request(server)
          .patch(`/admin/join-requests/${id}`)
          .send({ status: 'DECLINED' }),
      () => request(server).delete(`/admin/join-requests/${id}`),
      () => request(server).post(`/admin/join-requests/${id}/invite`),
      () => request(server).get('/admin/invitations'),
      () => request(server).post('/admin/invitations').send({}),
      () => request(server).delete(`/admin/invitations/${id}`),
    ];
    for (const route of routes) {
      await route().expect(401);
      await route().set('Cookie', practitioner.cookie).expect(403);
    }
  });
});
