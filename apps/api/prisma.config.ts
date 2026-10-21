import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/*
 * Prisma 7 no longer loads .env by itself: dotenv/config reads apps/api/.env
 * because every db:* script runs from apps/api.
 *
 * LOCAL_DATABASE_URL first: locally, DATABASE_URL is the shared dev database
 * through the SSH tunnel, and `migrate dev` may offer to reset whatever it
 * targets. In the containers only DATABASE_URL exists.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL,
  },
});
