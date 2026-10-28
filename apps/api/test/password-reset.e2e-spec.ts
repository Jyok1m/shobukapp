import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  cleanupTestUsers,
  createTestApp,
  registerUser,
  TEST_PASSWORD,
  testEmail,
} from './utils';

const NEW_PASSWORD = 'a-brand-new-password';

describe('Password reset and temporary passwords (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let send: jest.SpyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    send = jest.spyOn(app.get(MailService), 'send');
  });

  beforeEach(() => send.mockClear());

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.close();
  });

  async function requestLink(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email })
      .expect(204);
    const mail = send.mock.calls
      .map(([m]) => m as { to: string; text: string })
      .find((m) => m.to === email);
    const token = /token=([\w-]{43})/.exec(mail?.text ?? '')?.[1];
    if (!token) throw new Error('no reset link mailed');
    return token;
  }

  it('answers the same for an unknown address and sends nothing', async () => {
    await request(app.getHttpServer())
      .post('/auth/password/forgot')
      .send({ email: testEmail() })
      .expect(204);
    expect(send).not.toHaveBeenCalled();
  });

  it('resets with a mailed link once, signs out every session, stores only the hash', async () => {
    const member = await registerUser(app);
    const server = app.getHttpServer();
    const token = await requestLink(member.email);

    const stored = await prisma.passwordReset.findMany({
      where: { userId: member.id },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toEqual(token);

    await request(server)
      .post('/auth/password/reset')
      .send({ token, newPassword: 'short' })
      .expect(400);
    await request(server)
      .post('/auth/password/reset')
      .send({ token, newPassword: NEW_PASSWORD })
      .expect(204);

    await request(server)
      .get('/auth/me')
      .set('Cookie', member.cookie)
      .expect(401);
    await request(server)
      .post('/auth/login')
      .send({ email: member.email, password: TEST_PASSWORD })
      .expect(401);
    await request(server)
      .post('/auth/login')
      .send({ email: member.email, password: NEW_PASSWORD })
      .expect(200);

    const again = await request(server)
      .post('/auth/password/reset')
      .send({ token, newPassword: 'yet-another-password' })
      .expect(400);
    expect(again.body).toMatchObject({ code: 'invalid_reset_token' });
  });

  it('refuses an expired link and a replaced one', async () => {
    const member = await registerUser(app);
    const server = app.getHttpServer();
    const first = await requestLink(member.email);
    const second = await requestLink(member.email);

    await request(server)
      .post('/auth/password/reset')
      .send({ token: first, newPassword: NEW_PASSWORD })
      .expect(400);

    await prisma.passwordReset.updateMany({
      where: { userId: member.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(server)
      .post('/auth/password/reset')
      .send({ token: second, newPassword: NEW_PASSWORD })
      .expect(400);
  });

  it('lets an admin set a temporary password, with their own password, never on themself', async () => {
    const server = app.getHttpServer();
    const admin = await registerUser(app);
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'ADMIN' },
    });
    const member = await registerUser(app);
    const route = `/admin/members/${member.id}/password`;
    const temporaryPassword = 'temporary-password-42';

    await request(server)
      .post(route)
      .set('Cookie', member.cookie)
      .send({ temporaryPassword, password: TEST_PASSWORD })
      .expect(403);
    const wrong = await request(server)
      .post(route)
      .set('Cookie', admin.cookie)
      .send({ temporaryPassword, password: 'not-my-password' })
      .expect(403);
    expect(wrong.body).toMatchObject({ code: 'password_confirmation_failed' });
    const self = await request(server)
      .post(`/admin/members/${admin.id}/password`)
      .set('Cookie', admin.cookie)
      .send({ temporaryPassword, password: TEST_PASSWORD })
      .expect(400);
    expect(self.body).toMatchObject({ code: 'cannot_reset_own_password' });

    const pendingLink = await requestLink(member.email);
    await request(server)
      .post(route)
      .set('Cookie', admin.cookie)
      .send({ temporaryPassword, password: TEST_PASSWORD })
      .expect(204);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: member.email }),
    );
    expect(JSON.stringify(send.mock.calls)).not.toContain(temporaryPassword);

    await request(server)
      .get('/auth/me')
      .set('Cookie', member.cookie)
      .expect(401);
    await request(server)
      .post('/auth/password/reset')
      .send({ token: pendingLink, newPassword: NEW_PASSWORD })
      .expect(400);

    const login = await request(server)
      .post('/auth/login')
      .send({ email: member.email, password: temporaryPassword })
      .expect(200);
    expect(login.body).toMatchObject({ mustChangePassword: true });
    const cookie = login.get('Set-Cookie')?.[0]?.split(';')[0] ?? '';
    const blocked = await request(server)
      .get('/me')
      .set('Cookie', cookie)
      .expect(403);
    expect(blocked.body).toMatchObject({ code: 'password_change_required' });
  });

  it('clears a temporary password and asks for the terms when the account never accepted them', async () => {
    const server = app.getHttpServer();
    const member = await registerUser(app);
    await prisma.user.update({
      where: { id: member.id },
      data: { mustChangePassword: true, termsAcceptedAt: null },
    });
    const token = await requestLink(member.email);

    const noTerms = await request(server)
      .post('/auth/password/reset')
      .send({ token, newPassword: NEW_PASSWORD })
      .expect(400);
    expect(noTerms.body).toMatchObject({ code: 'terms_required' });
    await request(server)
      .post('/auth/password/reset')
      .send({ token, newPassword: NEW_PASSWORD, acceptTerms: true })
      .expect(204);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: member.id },
      select: { mustChangePassword: true, termsAcceptedAt: true },
    });
    expect(user.mustChangePassword).toBe(false);
    expect(user.termsAcceptedAt).not.toBeNull();
  });
});
