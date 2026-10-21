import { config } from 'dotenv';

/*
 * The e2e suites create and delete users: they run on the local database
 * (LOCAL_DATABASE_URL), never on the shared dev or production one that
 * DATABASE_URL reaches through the SSH tunnel. CI sets DATABASE_URL to its
 * throwaway container and has no .env.
 */
config({ quiet: true });
if (process.env.LOCAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.LOCAL_DATABASE_URL;
} else if (!process.env.CI) {
  // The tunnel's local port is configurable: a port check alone is not enough.
  throw new Error('e2e refused: set LOCAL_DATABASE_URL (CI sets CI=true).');
}
const port = new URL(
  process.env.DATABASE_URL ?? 'postgresql://x@localhost:5432/x',
).port;
if (port === '15433' || port === '5433') {
  throw new Error(
    `e2e refused: DATABASE_URL targets port ${port}, the server databases. Set LOCAL_DATABASE_URL.`,
  );
}
