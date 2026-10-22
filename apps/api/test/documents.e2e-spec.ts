import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanupTestUsers, createTestApp, registerUser } from './utils';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

describe('Documents and licences (e2e)', () => {
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
    await prisma.document.deleteMany({
      where: { ownerId: null, title: { startsWith: 'e2e ' } },
    });
    await cleanupTestUsers(app);
    await app.close();
  });

  it('stores a medical certificate checked by content, readable by owner and admin only', async () => {
    const owner = await registerUser(app);
    const other = await registerUser(app);
    const server = app.getHttpServer();

    await request(server)
      .post('/documents')
      .set('Cookie', owner.cookie)
      .field('title', 'Faux PDF')
      .field('category', 'MEDICAL_CERTIFICATE')
      .attach('file', Buffer.from('<html>'), {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    await request(server)
      .post('/documents')
      .set('Cookie', owner.cookie)
      .field('title', 'Statuts')
      .field('category', 'LEGAL')
      .attach('file', PDF, {
        filename: 'x.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    await request(server)
      .post('/documents')
      .set('Cookie', owner.cookie)
      .field('title', 'Sans date')
      .field('category', 'MEDICAL_CERTIFICATE')
      .attach('file', PDF, {
        filename: 'c.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    const created = await request(server)
      .post('/documents')
      .set('Cookie', owner.cookie)
      .field('title', 'Certificat médical 2026')
      .field('category', 'MEDICAL_CERTIFICATE')
      .field('validUntil', '2027-09-01')
      .attach('file', PDF, {
        filename: '../../etc/passwd.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const doc = created.body as {
      id: string;
      storageKey?: string;
      mimeType: string;
    };
    expect(doc.storageKey).toBeUndefined();
    expect(doc.mimeType).toBe('application/pdf');

    const file = await request(server)
      .get(`/documents/${doc.id}/file`)
      .set('Cookie', owner.cookie)
      .expect(200);
    expect(file.get('Content-Disposition')).toBe(
      'attachment; filename="Certificat-medical-2026.pdf"',
    );
    await request(server)
      .get(`/documents/${doc.id}/file`)
      .set('Cookie', admin.cookie)
      .expect(200);
    await request(server)
      .get(`/documents/${doc.id}/file`)
      .set('Cookie', other.cookie)
      .expect(404);
    await request(server)
      .delete(`/documents/${doc.id}`)
      .set('Cookie', other.cookie)
      .expect(404);

    const list = await request(server)
      .get('/admin/members')
      .query({ q: owner.email })
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(
      (list.body as { items: { medicalCertificate: unknown }[] }).items[0]
        .medicalCertificate,
    ).toEqual({
      validUntil: expect.stringMatching(/^2027-09-01/) as unknown,
    });

    await request(server)
      .delete(`/documents/${doc.id}`)
      .set('Cookie', owner.cookie)
      .expect(204);
    expect(await prisma.document.count({ where: { id: doc.id } })).toBe(0);
  });

  it('keeps dojo documents for admins only', async () => {
    const member = await registerUser(app);
    const server = app.getHttpServer();
    await request(server)
      .get('/admin/documents')
      .set('Cookie', member.cookie)
      .expect(403);

    const created = await request(server)
      .post('/admin/documents')
      .set('Cookie', admin.cookie)
      .field('title', 'e2e Statuts du dojo')
      .field('category', 'LEGAL')
      .attach('file', PDF, {
        filename: 'statuts.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    await request(server)
      .get(`/documents/${id}/file`)
      .set('Cookie', member.cookie)
      .expect(404);
    await request(server)
      .get(`/documents/${id}/file`)
      .set('Cookie', admin.cookie)
      .expect(200);
    const list = await request(server)
      .get('/documents')
      .set('Cookie', member.cookie)
      .expect(200);
    expect(list.body).toEqual([]);
  });

  it('uploads a licence per season, replaces it, and shows it to its owner only', async () => {
    const member = await registerUser(app);
    const other = await registerUser(app);
    const server = app.getHttpServer();

    await request(server)
      .post('/admin/licenses')
      .set('Cookie', member.cookie)
      .field('userId', member.id)
      .field('season', '2026-2027')
      .field('discipline', 'KENDO')
      .field('number', 'X')
      .expect(403);
    await request(server)
      .post('/admin/licenses')
      .set('Cookie', admin.cookie)
      .field('userId', member.id)
      .field('season', '2026')
      .field('discipline', 'KENDO')
      .field('number', 'X')
      .expect(400);
    await request(server)
      .post('/admin/licenses')
      .set('Cookie', admin.cookie)
      .field('userId', member.id)
      .field('season', '2026-2027')
      .field('discipline', 'KARATE')
      .field('number', 'X')
      .expect(400);

    const first = await request(server)
      .post('/admin/licenses')
      .set('Cookie', admin.cookie)
      .field('userId', member.id)
      .field('season', '2026-2027')
      .field('discipline', 'KENDO')
      .field('number', 'FFJDA-001')
      .attach('file', PDF, {
        filename: 'licence.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const second = await request(server)
      .post('/admin/licenses')
      .set('Cookie', admin.cookie)
      .field('userId', member.id)
      .field('season', '2026-2027')
      .field('discipline', 'KENDO')
      .field('number', 'FFJDA-002')
      .attach('file', PDF, {
        filename: 'licence.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const id = (first.body as { id: string }).id;
    expect((second.body as { id: string }).id).toBe(id);

    // Another discipline: its own row and file, the season's number for both.
    const iaido = await request(server)
      .post('/admin/licenses')
      .set('Cookie', admin.cookie)
      .field('userId', member.id)
      .field('season', '2026-2027')
      .field('discipline', 'IAIDO')
      .field('number', 'FFJDA-003')
      .attach('file', PDF, {
        filename: 'licence.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    const iaidoId = (iaido.body as { id: string }).id;
    expect(iaidoId).not.toBe(id);

    const mine = await request(server)
      .get('/licenses')
      .set('Cookie', member.cookie)
      .expect(200);
    expect(mine.body).toEqual([
      expect.objectContaining({
        id,
        season: '2026-2027',
        discipline: 'KENDO',
        number: 'FFJDA-003',
        hasFile: true,
      }),
      expect.objectContaining({
        id: iaidoId,
        season: '2026-2027',
        discipline: 'IAIDO',
        number: 'FFJDA-003',
        hasFile: true,
      }),
    ]);
    await request(server)
      .get(`/licenses/${id}/file`)
      .set('Cookie', member.cookie)
      .expect(200);
    await request(server)
      .get(`/licenses/${id}/file`)
      .set('Cookie', other.cookie)
      .expect(404);

    for (const viewer of [member, admin]) {
      const view = await request(server)
        .get(`/licenses/${id}/view`)
        .set('Cookie', viewer.cookie)
        .expect(200)
        .expect('Content-Type', 'application/pdf');
      expect(view.get('Content-Disposition')).toBe(
        'inline; filename="licence-ffjda-2026-2027-kendo.pdf"',
      );
      expect(view.get('X-Content-Type-Options')).toBe('nosniff');
      expect(view.get('Cache-Control')).toBe('private, no-store');
      expect(view.get('Content-Security-Policy')).toBe(
        "frame-ancestors 'self'",
      );
    }
    await request(server)
      .get(`/licenses/${id}/view`)
      .set('Cookie', other.cookie)
      .expect(404);
    await request(server)
      .get('/licenses/00000000-0000-4000-8000-000000000000/view')
      .set('Cookie', member.cookie)
      .expect(404);
  });
});

describe('Dojo board (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.document.deleteMany({
      where: { ownerId: null, title: { startsWith: 'e2e board' } },
    });
    await cleanupTestUsers(app);
    await app.close();
  });

  it('shows published dojo documents to members, read-only, and never a member document', async () => {
    const admin = await registerUser(app);
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: 'ADMIN' },
    });
    const member = await registerUser(app);
    const server = app.getHttpServer();

    const upload = (title: string, placement: string) =>
      request(server)
        .post('/admin/documents')
        .set('Cookie', admin.cookie)
        .field('title', title)
        .field('category', 'RULES')
        .field('placement', placement)
        .field('description', 'À lire avant le premier keiko.')
        .attach('file', PDF, {
          filename: 'r.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
    const important = (await upload('e2e board règlement', 'IMPORTANT'))
      .body as { id: string; publishedAt: string };
    expect(important.publishedAt).toBeTruthy();
    const hidden = (await upload('e2e board compta', 'PRIVATE')).body as {
      id: string;
    };

    const board = await request(server)
      .get('/documents/board')
      .set('Cookie', member.cookie)
      .expect(200);
    const ids = (
      board.body as {
        important: { id: string }[];
        announcements: { id: string }[];
      }
    ).important.map((d) => d.id);
    expect(ids).toContain(important.id);
    expect(ids).not.toContain(hidden.id);

    await request(server)
      .get(`/documents/${important.id}/file`)
      .set('Cookie', member.cookie)
      .expect(200);
    await request(server)
      .get(`/documents/${hidden.id}/file`)
      .set('Cookie', member.cookie)
      .expect(404);
    await request(server)
      .delete(`/documents/${important.id}`)
      .set('Cookie', member.cookie)
      .expect(404);
    await request(server)
      .patch(`/documents/${important.id}`)
      .set('Cookie', member.cookie)
      .send({ placement: 'PRIVATE' })
      .expect(404);

    await request(server)
      .patch(`/documents/${important.id}`)
      .set('Cookie', admin.cookie)
      .send({ placement: 'ANNOUNCEMENT' })
      .expect(200);
    const moved = await request(server)
      .get('/documents/board')
      .set('Cookie', member.cookie)
      .expect(200);
    expect(
      (moved.body as { announcements: { id: string }[] }).announcements.map(
        (d) => d.id,
      ),
    ).toContain(important.id);

    const certificate = await request(server)
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
      .patch(`/documents/${(certificate.body as { id: string }).id}`)
      .set('Cookie', admin.cookie)
      .send({ placement: 'IMPORTANT' })
      .expect(400);
  });
});
