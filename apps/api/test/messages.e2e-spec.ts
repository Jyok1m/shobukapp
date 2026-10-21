import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestUsers, createTestApp, registerUser } from './utils';

describe('Messages (e2e)', () => {
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

  async function listed() {
    const user = await registerUser(app);
    await prisma.user.update({
      where: { id: user.id },
      data: { directoryVisible: true },
    });
    return user;
  }

  it('sends, lists conversations with unread counts, and marks as read', async () => {
    const aiko = await listed();
    const julien = await listed();
    const server = app.getHttpServer();

    await request(server)
      .post('/messages')
      .set('Cookie', aiko.cookie)
      .send({ recipientId: julien.id, body: '  Keiko jeudi ?  ' })
      .expect(201)
      .expect((res) =>
        expect((res.body as { body: string }).body).toBe('Keiko jeudi ?'),
      );

    const convs = await request(server)
      .get('/messages/conversations')
      .set('Cookie', julien.cookie)
      .expect(200);
    expect(convs.body).toEqual([
      expect.objectContaining({
        counterpart: expect.objectContaining({
          id: aiko.id,
          firstName: 'Test',
        }) as unknown,
        unread: 1,
      }),
    ]);
    expect(JSON.stringify(convs.body)).not.toMatch(/email|phone|photoKey/);

    await request(server)
      .get('/messages/unread-count')
      .set('Cookie', julien.cookie)
      .expect(200, { unread: 1 });
    await request(server)
      .post(`/messages/with/${aiko.id}/read`)
      .set('Cookie', julien.cookie)
      .expect(200);
    await request(server)
      .get('/messages/unread-count')
      .set('Cookie', julien.cookie)
      .expect(200, { unread: 0 });

    const thread = await request(server)
      .get(`/messages/with/${julien.id}`)
      .set('Cookie', aiko.cookie)
      .expect(200);
    expect(thread.body).toMatchObject({ canWrite: true, nextCursor: null });
    expect((thread.body as { items: unknown[] }).items).toHaveLength(1);
  });

  it('refuses writing to an unlisted member, but lets them answer', async () => {
    const hidden = await registerUser(app);
    const writer = await listed();
    const server = app.getHttpServer();

    await request(server)
      .post('/messages')
      .set('Cookie', writer.cookie)
      .send({ recipientId: hidden.id, body: 'Bonjour' })
      .expect(404);
    await request(server)
      .get(`/messages/with/${hidden.id}`)
      .set('Cookie', writer.cookie)
      .expect(404);
    await request(server)
      .post('/messages')
      .set('Cookie', hidden.cookie)
      .send({
        recipientId: writer.id,
        body: 'Bonjour, je ne suis pas dans l annuaire',
      })
      .expect(201);
    await request(server)
      .post('/messages')
      .set('Cookie', writer.cookie)
      .send({ recipientId: hidden.id, body: 'Je te réponds' })
      .expect(201);
  });

  it('refuses empty, oversized and self messages, and other people threads leak nothing', async () => {
    const a = await listed();
    const b = await listed();
    const c = await registerUser(app);
    const server = app.getHttpServer();

    await request(server)
      .post('/messages')
      .set('Cookie', a.cookie)
      .send({ recipientId: b.id, body: '   ' })
      .expect(400);
    await request(server)
      .post('/messages')
      .set('Cookie', a.cookie)
      .send({ recipientId: b.id, body: 'x'.repeat(2001) })
      .expect(400);
    await request(server)
      .post('/messages')
      .set('Cookie', a.cookie)
      .send({ recipientId: a.id, body: 'moi' })
      .expect(404);

    await request(server)
      .post('/messages')
      .set('Cookie', a.cookie)
      .send({ recipientId: b.id, body: 'secret' })
      .expect(201);
    const peek = await request(server)
      .get(`/messages/with/${b.id}`)
      .set('Cookie', c.cookie)
      .expect(200);
    expect((peek.body as { items: unknown[] }).items).toEqual([]);
    await request(server).get('/messages/conversations').expect(401);
  });

  it('lets an admin write to an unlisted member', async () => {
    const admin = await registerUser(app);
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'ADMIN' },
    });
    const hidden = await registerUser(app);
    await request(app.getHttpServer())
      .post('/messages')
      .set('Cookie', admin.cookie)
      .send({
        recipientId: hidden.id,
        body: 'Votre certificat expire bientôt.',
      })
      .expect(201);
  });
});
