import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Standalone client for CLI scripts, outside the Nest container.
export function scriptPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Missing DATABASE_URL');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
