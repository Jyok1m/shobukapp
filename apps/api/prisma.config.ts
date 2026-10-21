import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env by itself: dotenv/config reads apps/api/.env
// because every db:* script runs from apps/api.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
