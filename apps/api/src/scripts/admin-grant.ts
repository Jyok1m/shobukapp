import { scriptPrisma } from './script-prisma';

// Usage: pnpm --filter @shobukapp/api admin:grant <email>
// The only way to grant ADMIN: no HTTP route changes a role (docs/auth.md).
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: admin:grant <email>');

  const prisma = scriptPrisma();
  try {
    const { count } = await prisma.user.updateMany({
      where: { email },
      data: { role: 'ADMIN' },
    });
    if (!count) throw new Error(`No user with email ${email}`);
    console.log(`${email} is now ADMIN`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
