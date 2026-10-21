import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestUsers, createTestApp, registerUser } from './utils';

// Smallest valid PNG (1x1 transparent pixel).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

describe('Profile and directory (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.close();
  });

  it('updates the profile, clears optional fields and refuses forbidden ones', async () => {
    const { cookie } = await registerUser(app);
    const server = app.getHttpServer();

    const res = await request(server)
      .patch('/me')
      .set('Cookie', cookie)
      .send({
        phone: ' 06 00 00 00 00 ',
        birthDate: '1990-04-12',
        sex: 'FEMALE',
        city: 'Paris',
      })
      .expect(200);
    expect(res.body).toMatchObject({
      phone: '06 00 00 00 00',
      sex: 'FEMALE',
      city: 'Paris',
    });
    expect((res.body as { birthDate: string }).birthDate).toMatch(
      /^1990-04-12/,
    );

    const cleared = await request(server)
      .patch('/me')
      .set('Cookie', cookie)
      .send({ city: '' })
      .expect(200);
    expect((cleared.body as { city: string | null }).city).toBeNull();

    await request(server)
      .patch('/me')
      .set('Cookie', cookie)
      .send({ role: 'ADMIN' })
      .expect(400);
    await request(server)
      .patch('/me')
      .set('Cookie', cookie)
      .send({ email: 'x@y.z' })
      .expect(400);
    await request(server)
      .patch('/me')
      .set('Cookie', cookie)
      .send({ passwordHash: 'x' })
      .expect(400);
    await request(server)
      .patch('/me')
      .set('Cookie', cookie)
      .send({ firstName: null })
      .expect(400);
  });

  it('lists only opted-in members, without private fields', async () => {
    const hidden = await registerUser(app);
    const visible = await registerUser(app);
    const server = app.getHttpServer();
    await request(server)
      .patch('/me')
      .set('Cookie', visible.cookie)
      .send({
        directoryVisible: true,
        birthDate: '1985-01-01',
        addressLine: '1 rue du Dojo',
      })
      .expect(200);

    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await request(server)
        .get('/members')
        .query(cursor ? { cursor } : {})
        .set('Cookie', hidden.cookie)
        .expect(200);
      const body = page.body as {
        items: Record<string, unknown>[];
        nextCursor: string | null;
      };
      for (const item of body.items) {
        expect(Object.keys(item).sort()).toEqual(
          ['email', 'firstName', 'hasPhoto', 'id', 'lastName', 'phone'].sort(),
        );
        ids.push(item.id as string);
      }
      cursor = body.nextCursor;
    } while (cursor);

    expect(ids).toContain(visible.id);
    await request(server)
      .get('/members')
      .query({ cursor: '-'.repeat(36) })
      .set('Cookie', hidden.cookie)
      .expect(400);
    expect(ids).not.toContain(hidden.id);
    await request(server).get('/members').expect(401);
  });

  it('uploads a photo checked by content, and hides it from others when not listed', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const server = app.getHttpServer();

    await request(server)
      .post('/me/photo')
      .set('Cookie', owner.cookie)
      .attach('file', Buffer.from('<svg></svg>'), {
        filename: 'a.png',
        contentType: 'image/png',
      })
      .expect(400);

    const res = await request(server)
      .post('/me/photo')
      .set('Cookie', owner.cookie)
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' })
      .expect(201);
    expect((res.body as { photoKey: string }).photoKey).toBeTruthy();

    await request(server)
      .get(`/members/${owner.id}/photo`)
      .set('Cookie', owner.cookie)
      .expect(200)
      .expect('Content-Type', 'image/png');
    await request(server)
      .get(`/members/${owner.id}/photo`)
      .set('Cookie', other.cookie)
      .expect(404);
    const prisma = app.get(PrismaService);
    await prisma.user.update({
      where: { id: other.id },
      data: { role: 'ADMIN' },
    });
    await request(server)
      .get(`/members/${owner.id}/photo`)
      .set('Cookie', other.cookie)
      .expect(200);
    await prisma.user.update({
      where: { id: other.id },
      data: { role: 'PRACTITIONER' },
    });

    await request(server)
      .patch('/me')
      .set('Cookie', owner.cookie)
      .send({ directoryVisible: true })
      .expect(200);
    await request(server)
      .get(`/members/${owner.id}/photo`)
      .set('Cookie', other.cookie)
      .expect(200);

    await request(server)
      .delete('/me/photo')
      .set('Cookie', owner.cookie)
      .expect(200);
    await request(server)
      .get(`/members/${owner.id}/photo`)
      .set('Cookie', owner.cookie)
      .expect(404);
  });
});
