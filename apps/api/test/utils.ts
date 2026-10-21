import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  generateLinkToken,
  hashSecret,
} from '../src/onboarding/invitation-codes';

export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    rawBody: true,
  });
  configureApp(app);
  await app.init();
  return app;
}

export const TEST_PASSWORD = 'correct-horse-battery';

// Every test user lives under this domain, removed in afterAll.
export const TEST_DOMAIN = 'e2e.shobukapp.test';

export function testEmail(): string {
  return `${randomUUID()}@${TEST_DOMAIN}`;
}

// Signup is invitation-only: a link invitation is written straight to the
// database, as an admin would have sent it.
export async function createLinkInvitation(
  app: NestExpressApplication,
  email = testEmail(),
  overrides: Partial<{ expiresAt: Date }> = {},
): Promise<{ email: string; token: string; id: string }> {
  const token = generateLinkToken();
  const invitation = await app.get(PrismaService).invitation.create({
    data: {
      kind: 'LINK',
      email,
      firstName: 'Test',
      lastName: 'User',
      tokenHash: hashSecret(token),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 3600_000),
    },
  });
  return { email, token, id: invitation.id };
}

export async function registerUser(
  app: NestExpressApplication,
  email = testEmail(),
): Promise<{ email: string; cookie: string; id: string }> {
  const { token } = await createLinkInvitation(app, email);
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      token,
      password: TEST_PASSWORD,
      firstName: 'Test',
      lastName: 'User',
      acceptTerms: true,
    })
    .expect(201);
  const cookie = res.get('Set-Cookie')?.[0]?.split(';')[0] ?? '';
  return { email, cookie, id: (res.body as { id: string }).id };
}

export async function cleanupTestUsers(app: NestExpressApplication) {
  const prisma = app.get(PrismaService);
  const where = { email: { endsWith: `@${TEST_DOMAIN}` } };
  await prisma.invitation.deleteMany({ where });
  await prisma.joinRequest.deleteMany({ where });
  await prisma.user.deleteMany({ where });
}
