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

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.close();
  });

  it('registers a practitioner, sets an httpOnly cookie and never returns the hash', async () => {
    const email = testEmail();
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: email.toUpperCase(),
        password: TEST_PASSWORD,
        firstName: ' Aiko ',
        lastName: 'Martin',
        acceptTerms: true,
      })
      .expect(201);

    expect(res.body).toMatchObject({
      email,
      role: 'PRACTITIONER',
      firstName: 'Aiko',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
    const cookie = res.get('Set-Cookie')?.[0] ?? '';
    expect(cookie).toMatch(/^shobukapp_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('stores only the hash of the session token', async () => {
    const { cookie, id } = await registerUser(app);
    const token = cookie.split('=')[1];
    const sessions = await app
      .get(PrismaService)
      .session.findMany({ where: { userId: id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).not.toEqual(token);
  });

  it('refuses a duplicate email, a short password, missing consent and unknown fields', async () => {
    const { email } = await registerUser(app);
    const base = {
      email: testEmail(),
      password: TEST_PASSWORD,
      firstName: 'A',
      lastName: 'B',
      acceptTerms: true,
    };
    const server = app.getHttpServer();

    await request(server)
      .post('/auth/register')
      .send({ ...base, email })
      .expect(409);
    await request(server)
      .post('/auth/register')
      .send({ ...base, password: 'short' })
      .expect(400);
    await request(server)
      .post('/auth/register')
      .send({ ...base, acceptTerms: false })
      .expect(400);
    await request(server)
      .post('/auth/register')
      .send({ ...base, role: 'ADMIN' })
      .expect(400);
  });

  it('logs in, reads /auth/me, logs out and the cookie stops working', async () => {
    const { email } = await registerUser(app);
    const server = app.getHttpServer();

    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    const cookie = login.get('Set-Cookie')?.[0]?.split(';')[0] ?? '';

    const me = await request(server)
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(me.body).toMatchObject({ email });

    await request(server)
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(204);
    await request(server).get('/auth/me').set('Cookie', cookie).expect(401);
  });

  it('answers the same error for an unknown email and a wrong password', async () => {
    const { email } = await registerUser(app);
    const server = app.getHttpServer();

    const wrong = await request(server)
      .post('/auth/login')
      .send({ email, password: 'not-the-password' })
      .expect(401);
    const unknown = await request(server)
      .post('/auth/login')
      .send({ email: testEmail(), password: TEST_PASSWORD })
      .expect(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body).toMatchObject({ code: 'invalid_credentials' });
  });

  it('changing the password revokes the other sessions only', async () => {
    const { email, cookie } = await registerUser(app);
    const server = app.getHttpServer();
    const other = await request(server)
      .post('/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    const otherCookie = other.get('Set-Cookie')?.[0]?.split(';')[0] ?? '';

    await request(server)
      .post('/auth/password')
      .set('Cookie', cookie)
      .send({
        currentPassword: TEST_PASSWORD,
        newPassword: 'another-long-password',
      })
      .expect(204);

    await request(server).get('/auth/me').set('Cookie', cookie).expect(200);
    await request(server)
      .get('/auth/me')
      .set('Cookie', otherCookie)
      .expect(401);
  });

  it('rejects requests without a session and keeps /health public', async () => {
    const server = app.getHttpServer();
    await request(server).get('/auth/me').expect(401);
    await request(server).get('/health').expect(200);
  });
});

describe('Sessions and throttling (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.close();
  });

  it('renews a session past half its lifetime and re-sets the cookie', async () => {
    const { cookie, id } = await registerUser(app);
    const soon = new Date(Date.now() + 60_000);
    await prisma.session.updateMany({
      where: { userId: id },
      data: { expiresAt: soon },
    });

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.get('Set-Cookie')?.[0]).toMatch(/^shobukapp_session=/);
    const session = await prisma.session.findFirstOrThrow({
      where: { userId: id },
    });
    expect(session.expiresAt.getTime()).toBeGreaterThan(
      soon.getTime() + DAY_MS,
    );
  });

  it('deletes an expired session and clears the cookie', async () => {
    const { cookie, id } = await registerUser(app);
    await prisma.session.updateMany({
      where: { userId: id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(401);
    expect(res.get('Set-Cookie')?.[0]).toMatch(/shobukapp_session=;/);
    expect(await prisma.session.count({ where: { userId: id } })).toBe(0);
  });

  it('clears the cookie for an unknown token', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', 'shobukapp_session=forged')
      .expect(401);
    expect(res.get('Set-Cookie')?.[0]).toMatch(/shobukapp_session=;/);
  });

  it('revokes the incoming session on a new login', async () => {
    const { email, cookie, id } = await registerUser(app);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Cookie', cookie)
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(401);
    expect(await prisma.session.count({ where: { userId: id } })).toBe(1);
  });

  it('throttles login per email whatever X-Forwarded-For says', async () => {
    const { email } = await registerUser(app);
    const server = app.getHttpServer();
    for (let i = 0; i < 10; i++) {
      await request(server)
        .post('/auth/login')
        .set('X-Forwarded-For', `10.0.0.${i}`)
        .send({ email, password: 'wrong-password' })
        .expect(401);
    }
    await request(server)
      .post('/auth/login')
      .set('X-Forwarded-For', '10.0.0.99')
      .send({ email, password: TEST_PASSWORD })
      .expect(429);
  });
});
