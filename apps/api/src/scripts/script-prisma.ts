import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/*
 * Standalone client for CLI scripts, outside the Nest container. The seed
 * passes `local`: fake members belong in the local database, never in the
 * shared dev one that DATABASE_URL points to through the tunnel. No fallback.
 */
export function scriptPrisma(target: 'app' | 'local' = 'app'): PrismaClient {
  if (target === 'local' && !process.env.LOCAL_DATABASE_URL) {
    throw new Error(
      'LOCAL_DATABASE_URL is required: the seed never writes to DATABASE_URL',
    );
  }
  const connectionString =
    target === 'local'
      ? process.env.LOCAL_DATABASE_URL
      : process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Missing DATABASE_URL');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
