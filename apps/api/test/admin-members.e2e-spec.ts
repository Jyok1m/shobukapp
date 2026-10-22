import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestUsers, createTestApp, registerUser } from './utils';

// The API resolves STORAGE_DIR from apps/api; the tests run with the default.
const STORAGE_ROOT = join(__dirname, '..', 'storage');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');

describe('Admin members (e2e)', () => {
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

  it('guards every /admin/members route: 401 for a visitor, 403 for a practitioner', async () => {
    const { cookie } = await registerUser(app);
    const server = app.getHttpServer();
    const id = randomUUID();
    const routes = [
      () => request(server).get('/admin/members'),
      () => request(server).get('/admin/members/export'),
      () => request(server).get(`/admin/members/${id}`),
      () => request(server).patch(`/admin/members/${id}`).send({}),
      () => request(server).delete(`/admin/members/${id}`),
      () => request(server).post(`/admin/members/${id}/reminders`).send({}),
    ];
    for (const route of routes) {
      await route().expect(401);
      await route().set('Cookie', cookie).expect(403);
    }
  });

  it('lists members with their payment status and filters late payers', async () => {
    const late = await registerUser(app);
    await prisma.subscription.create({
      data: {
        userId: late.id,
        stripeSubscriptionId: `sub_e2e_${randomUUID()}`,
        status: 'past_due',
      },
    });
    await prisma.payment.create({
      data: {
        userId: late.id,
        stripeInvoiceId: `in_e2e_${randomUUID()}`,
        amountCents: 2500,
        status: 'FAILED',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/admin/members')
      .query({ status: 'past_due', q: late.email })
      .set('Cookie', admin.cookie)
      .expect(200);
    const body = res.body as {
      items: {
        id: string;
        failedPayments: number;
        membership: { status: string };
      }[];
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: late.id,
      failedPayments: 1,
      membership: { status: 'past_due' },
    });
    expect(JSON.stringify(body)).not.toMatch(/password/i);

    await request(app.getHttpServer())
      .get('/admin/members')
      .query({ status: 'whatever' })
      .set('Cookie', admin.cookie)
      .expect(400);
  });

  it('edits a member profile but never role, email, password or directory consent', async () => {
    const member = await registerUser(app);
    const server = app.getHttpServer();
    await request(server)
      .patch(`/admin/members/${member.id}`)
      .set('Cookie', admin.cookie)
      .send({ city: 'Lyon', lastName: 'Corrigé' })
      .expect(200);
    for (const forbidden of [
      { role: 'ADMIN' },
      { email: 'x@y.z' },
      { passwordHash: 'x' },
      { directoryVisible: true },
    ]) {
      await request(server)
        .patch(`/admin/members/${member.id}`)
        .set('Cookie', admin.cookie)
        .send(forbidden)
        .expect(400);
    }
    const detail = await request(server)
      .get(`/admin/members/${member.id}`)
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(detail.body).toMatchObject({
      city: 'Lyon',
      lastName: 'Corrigé',
      directoryVisible: false,
    });
  });

  it('records a reminder with its author', async () => {
    const member = await registerUser(app);
    const res = await request(app.getHttpServer())
      .post(`/admin/members/${member.id}/reminders`)
      .set('Cookie', admin.cookie)
      .send({ note: 'Merci de régulariser avant le prochain keiko.' })
      .expect(201);
    expect(res.body).toMatchObject({ delivery: 'logged' });
    const reminders = await prisma.paymentReminder.findMany({
      where: { userId: member.id },
    });
    expect(reminders).toHaveLength(1);
    expect(reminders[0].sentById).toBe(admin.id);
  });

  it('exports a CSV without secrets, neutralises formulas and logs the export', async () => {
    const member = await registerUser(app);
    await prisma.user.update({
      where: { id: member.id },
      data: { city: '=HYPERLINK("http://evil")' },
    });
    const before = await prisma.memberExport.count();

    const res = await request(app.getHttpServer())
      .get('/admin/members/export')
      .set('Cookie', admin.cookie)
      .expect(200)
      .expect('Content-Type', /text\/csv/);
    const csv = res.text;
    expect(csv.startsWith('﻿Nom;Prénom;Email')).toBe(true);
    expect(csv).toContain(member.email);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).not.toMatch(/argon2|password/i);
    expect(await prisma.memberExport.count()).toBe(before + 1);
  });

  it('erases a member with their files, but not the admin themself', async () => {
    const member = await registerUser(app);
    const server = app.getHttpServer();
    await request(server)
      .post('/me/photo')
      .set('Cookie', member.cookie)
      .attach('file', PNG, { filename: 'me.png', contentType: 'image/png' })
      .expect(201);
    await request(server)
      .post('/documents')
      .set('Cookie', member.cookie)
      .field('title', 'Certificat')
      .field('category', 'MEDICAL_CERTIFICATE')
      .field('validUntil', '2027-09-01')
      .attach('file', PDF, {
        filename: 'c.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    await request(server)
      .post('/admin/licenses')
      .set('Cookie', admin.cookie)
      .field('userId', member.id)
      .field('season', '2026-2027')
      .field('discipline', 'KENDO')
      .field('number', 'FFJDA-ERASE')
      .attach('file', PDF, {
        filename: 'l.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: member.id },
      select: {
        photoKey: true,
        documents: { select: { storageKey: true } },
        licenses: { select: { storageKey: true } },
      },
    });
    const files = [
      stored.photoKey,
      ...stored.documents.map((d) => d.storageKey),
      ...stored.licenses.map((l) => l.storageKey),
    ].map((key) => join(STORAGE_ROOT, key!));
    expect(files).toHaveLength(3);
    files.forEach((file) => expect(existsSync(file)).toBe(true));

    await request(server)
      .delete(`/admin/members/${admin.id}`)
      .set('Cookie', admin.cookie)
      .expect(400);
    await request(server)
      .delete(`/admin/members/${member.id}`)
      .set('Cookie', admin.cookie)
      .expect(204);
    expect(await prisma.user.count({ where: { id: member.id } })).toBe(0);
    await request(server)
      .get('/auth/me')
      .set('Cookie', member.cookie)
      .expect(401);
    await request(server)
      .delete(`/admin/members/${member.id}`)
      .set('Cookie', admin.cookie)
      .expect(404);
  });
});
