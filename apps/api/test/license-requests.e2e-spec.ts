import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestUsers, createTestApp, registerUser } from './utils';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

type Item = {
  id: string;
  userId: string;
  season: string;
  discipline: string;
  status: string;
  note: string | null;
  sentAt: string | null;
  doneAt: string | null;
  member: Record<string, unknown>;
  missingFields: string[];
};

describe('Licence requests (e2e)', () => {
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

  const create = (body: object) =>
    request(app.getHttpServer())
      .post('/admin/license-requests')
      .set('Cookie', admin.cookie)
      .send(body);

  it('is for admins only', async () => {
    const member = await registerUser(app);
    const server = app.getHttpServer();
    await request(server)
      .get('/admin/license-requests')
      .set('Cookie', member.cookie)
      .expect(403);
    await request(server)
      .get('/admin/license-requests/export')
      .set('Cookie', member.cookie)
      .expect(403);
    await request(server)
      .post('/admin/license-requests')
      .set('Cookie', member.cookie)
      .send({ userId: member.id, season: '2030-2031', disciplines: ['KENDO'] })
      .expect(403);
  });

  it('creates one request per discipline, skipping existing requests and licences', async () => {
    const member = await registerUser(app);
    await create({
      userId: member.id,
      season: '2030',
      disciplines: ['KENDO'],
    }).expect(400);
    await create({
      userId: member.id,
      season: '2030-2031',
      disciplines: ['KENDO', 'KENDO'],
    }).expect(400);
    await create({
      userId: member.id,
      season: '2030-2031',
      disciplines: [],
    }).expect(400);
    const missing = await create({
      userId: '00000000-0000-4000-8000-000000000000',
      season: '2030-2031',
      disciplines: ['KENDO'],
    }).expect(404);
    expect(missing.body).toMatchObject({ code: 'member_not_found' });

    await request(app.getHttpServer())
      .post('/admin/licenses')
      .set('Cookie', admin.cookie)
      .field('userId', member.id)
      .field('season', '2030-2031')
      .field('discipline', 'JODO')
      .field('number', 'FFJDA-REQ')
      .attach('file', PDF, {
        filename: 'licence.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const first = await create({
      userId: member.id,
      season: '2030-2031',
      disciplines: ['KENDO', 'JODO'],
      note: '  Certificat reçu  ',
    }).expect(201);
    const body = first.body as { created: Item[]; skipped: string[] };
    expect(body.skipped).toEqual(['JODO']);
    expect(body.created).toHaveLength(1);
    expect(body.created[0]).toMatchObject({
      userId: member.id,
      season: '2030-2031',
      discipline: 'KENDO',
      status: 'PENDING',
      note: 'Certificat reçu',
      sentAt: null,
      doneAt: null,
      member: {
        id: member.id,
        firstName: 'Test',
        lastName: 'User',
        email: member.email,
      },
      missingFields: ['birthDate', 'sex', 'nationality', 'address'],
    });
    expect(Object.keys(body.created[0].member).sort()).toEqual([
      'email',
      'firstName',
      'id',
      'lastName',
    ]);
    const stored = await prisma.licenseRequest.findUniqueOrThrow({
      where: { id: body.created[0].id },
    });
    expect(stored.requestedById).toBe(admin.id);

    const again = await create({
      userId: member.id,
      season: '2030-2031',
      disciplines: ['KENDO', 'IAIDO'],
    }).expect(201);
    expect(again.body).toMatchObject({
      created: [{ discipline: 'IAIDO' }],
      skipped: ['KENDO'],
    });
  });

  it('lists with filters and cursor pagination', async () => {
    const member = await registerUser(app);
    const other = await registerUser(app);
    const server = app.getHttpServer();
    await create({
      userId: member.id,
      season: '2031-2032',
      disciplines: ['KENDO', 'IAIDO', 'JODO'],
    }).expect(201);
    await create({
      userId: member.id,
      season: '2032-2033',
      disciplines: ['BATTODO'],
    }).expect(201);
    await create({
      userId: other.id,
      season: '2031-2032',
      disciplines: ['KENDO'],
    }).expect(201);

    const list = (query: object) =>
      request(server)
        .get('/admin/license-requests')
        .query(query)
        .set('Cookie', admin.cookie)
        .expect(200)
        .then(
          (res) => res.body as { items: Item[]; nextCursor: string | null },
        );

    await request(server)
      .get('/admin/license-requests')
      .query({ limit: 101 })
      .set('Cookie', admin.cookie)
      .expect(400);
    await request(server)
      .get('/admin/license-requests')
      .query({ status: 'LOST' })
      .set('Cookie', admin.cookie)
      .expect(400);

    const all = await list({ userId: member.id });
    expect(all.items).toHaveLength(4);
    expect(all.nextCursor).toBeNull();
    expect(all.items.every((i) => i.userId === member.id)).toBe(true);

    const season = await list({ userId: member.id, season: '2031-2032' });
    expect(season.items.map((i) => i.discipline).sort()).toEqual([
      'IAIDO',
      'JODO',
      'KENDO',
    ]);

    const page1 = await list({ userId: member.id, limit: 3 });
    expect(page1.items).toHaveLength(3);
    expect(page1.nextCursor).toBe(page1.items[2].id);
    const page2 = await list({
      userId: member.id,
      limit: 3,
      cursor: page1.nextCursor,
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    expect(
      new Set([...page1.items, ...page2.items].map((i) => i.id)).size,
    ).toBe(4);
    expect([...page1.items, ...page2.items].map((i) => i.id)).toEqual(
      all.items.map((i) => i.id),
    );

    const pending = await list({ userId: other.id, status: 'PENDING' });
    expect(pending.items).toHaveLength(1);
    expect((await list({ userId: other.id, status: 'SENT' })).items).toEqual(
      [],
    );
  });

  it('moves between PENDING and SENT, closes on licence upload, then refuses changes', async () => {
    const member = await registerUser(app);
    const server = app.getHttpServer();
    const created = await create({
      userId: member.id,
      season: '2033-2034',
      disciplines: ['IAIDO', 'KENDO'],
    }).expect(201);
    const [iaido, kendo] = (created.body as { created: Item[] }).created;
    const patch = (id: string, body: object) =>
      request(server)
        .patch(`/admin/license-requests/${id}`)
        .set('Cookie', admin.cookie)
        .send(body);

    await patch(iaido.id, { status: 'DONE' }).expect(400);
    await patch(iaido.id, { status: 'SENT', extra: 1 }).expect(400);
    const missing = await patch('00000000-0000-4000-8000-000000000000', {
      status: 'SENT',
    }).expect(404);
    expect(missing.body).toMatchObject({ code: 'not_found' });

    const sent = (
      await patch(iaido.id, { status: 'SENT', note: 'Saisie' }).expect(200)
    ).body as Item;
    expect(sent).toMatchObject({ status: 'SENT', note: 'Saisie' });
    expect(sent.sentAt).toBeTruthy();
    expect(sent.member).toMatchObject({ id: member.id });

    const back = (
      await patch(iaido.id, { status: 'PENDING', note: '  ' }).expect(200)
    ).body as Item;
    expect(back).toMatchObject({ status: 'PENDING', sentAt: null, note: null });

    await patch(iaido.id, { status: 'SENT' }).expect(200);
    // A number alone (a renewal keeps it) does not close the request.
    await request(server)
      .post('/admin/licenses')
      .set('Cookie', admin.cookie)
      .field('userId', member.id)
      .field('season', '2033-2034')
      .field('discipline', 'IAIDO')
      .field('number', 'FFJDA-DONE')
      .expect(201);
    expect(
      (await prisma.licenseRequest.findUnique({ where: { id: iaido.id } }))!
        .status,
    ).toBe('SENT');
    await request(server)
      .post('/admin/licenses')
      .set('Cookie', admin.cookie)
      .field('userId', member.id)
      .field('season', '2033-2034')
      .field('discipline', 'IAIDO')
      .field('number', 'FFJDA-DONE')
      .attach('file', PDF, {
        filename: 'licence.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const rows = await prisma.licenseRequest.findMany({
      where: { userId: member.id },
    });
    const done = rows.find((r) => r.id === iaido.id)!;
    expect(done.status).toBe('DONE');
    expect(done.doneAt).toBeTruthy();
    expect(rows.find((r) => r.id === kendo.id)!.status).toBe('PENDING');

    const conflict = await patch(iaido.id, { status: 'PENDING' }).expect(409);
    expect(conflict.body).toMatchObject({ code: 'license_request_done' });
    await patch(iaido.id, { note: 'x' }).expect(409);
    await patch(iaido.id, {}).expect(409);
  });

  it('exports the extranet data without emergency contact, and journals it', async () => {
    const member = await registerUser(app);
    await prisma.user.update({
      where: { id: member.id },
      data: {
        lastName: 'Zz-Export',
        sex: 'FEMALE',
        birthDate: new Date('1990-05-04'),
        nationality: 'Française',
        addressLine: '255 avenue Daumesnil',
        postalCode: '75012',
        city: 'Paris',
        country: 'France',
        phone: '0143070565',
        emergencyContactName: 'Urgence Secrète',
        emergencyContactPhone: '0699999999',
      },
    });
    await prisma.license.create({
      data: {
        userId: member.id,
        season: '2038-2039',
        discipline: 'KENDO',
        number: 'FFJDA-RENEW',
      },
    });
    await create({
      userId: member.id,
      season: '2039-2040',
      disciplines: ['IAIDO'],
    }).expect(201);
    const before = await prisma.memberExport.count({
      where: { kind: 'LICENSE_REQUESTS' },
    });

    const res = await request(app.getHttpServer())
      .get('/admin/license-requests/export')
      .query({ season: '2039-2040' })
      .set('Cookie', admin.cookie)
      .expect(200)
      .expect('Content-Type', /text\/csv/);
    expect(res.get('Content-Disposition')).toMatch(
      /^attachment; filename="demandes-licences-ffjda-2039-2040-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    const lines = res.text.split('\r\n');
    expect(lines[0]).toBe(
      '﻿Nom;Prénom;Sexe;Date de naissance;Nationalité;Adresse;Code postal;Ville;Pays;Email;Téléphone;Saison;Discipline;Numéro de licence;Statut',
    );
    const line = lines.find((l) => l.includes(member.email));
    expect(line).toBe(
      `Zz-Export;Test;F;1990-05-04;Française;255 avenue Daumesnil;75012;Paris;France;${member.email};0143070565;2039-2040;Iaido;FFJDA-RENEW;À faire`,
    );
    expect(res.text).not.toContain('Urgence');
    expect(res.text).not.toContain('0699999999');
    expect(res.text).not.toMatch(/argon2/i);
    expect(
      await prisma.memberExport.count({ where: { kind: 'LICENSE_REQUESTS' } }),
    ).toBe(before + 1);

    await request(app.getHttpServer())
      .get('/admin/license-requests/export')
      .query({ season: 'all' })
      .set('Cookie', admin.cookie)
      .expect(400);
    const all = await request(app.getHttpServer())
      .get('/admin/license-requests/export')
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(all.get('Content-Disposition')).toMatch(
      /filename="demandes-licences-ffjda-toutes-/,
    );
  });

  it('deletes a request, and every request disappears with the member', async () => {
    const member = await registerUser(app);
    const server = app.getHttpServer();
    const created = await create({
      userId: member.id,
      season: '2034-2035',
      disciplines: ['KENDO', 'BATTODO'],
    }).expect(201);
    const [kendo] = (created.body as { created: Item[] }).created;

    await request(server)
      .delete(`/admin/license-requests/${kendo.id}`)
      .set('Cookie', admin.cookie)
      .expect(204);
    await request(server)
      .delete(`/admin/license-requests/${kendo.id}`)
      .set('Cookie', admin.cookie)
      .expect(404);
    expect(
      await prisma.licenseRequest.count({ where: { userId: member.id } }),
    ).toBe(1);

    await request(server)
      .delete(`/admin/members/${member.id}`)
      .set('Cookie', admin.cookie)
      .expect(204);
    expect(
      await prisma.licenseRequest.count({ where: { userId: member.id } }),
    ).toBe(0);
  });
});
