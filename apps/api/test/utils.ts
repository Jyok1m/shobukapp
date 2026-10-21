import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';

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

export async function registerUser(
  app: NestExpressApplication,
  email = testEmail(),
): Promise<{ email: string; cookie: string; id: string }> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email,
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
  await app
    .get(PrismaService)
    .user.deleteMany({ where: { email: { endsWith: `@${TEST_DOMAIN}` } } });
}
