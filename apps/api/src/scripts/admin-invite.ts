import {
  formatCode,
  generateCode,
  hashSecret,
} from '../onboarding/invitation-codes';
import { scriptPrisma } from './script-prisma';

// Usage: pnpm --filter @shobukapp/api admin:invite <email> <first> <last>
// Bootstraps the first account: signup is invitation-only and no admin exists
// yet to issue one. Prints the activation code, then use admin:grant.
async function main() {
  const [rawEmail, firstName, lastName] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!email || !firstName || !lastName) {
    throw new Error('Usage: admin:invite <email> <first name> <last name>');
  }

  const prisma = scriptPrisma();
  try {
    if (await prisma.user.count({ where: { email } })) {
      throw new Error(`${email} already has an account`);
    }
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    await prisma.invitation.create({
      data: {
        kind: 'CODE',
        email,
        firstName,
        lastName,
        tokenHash: hashSecret(code),
        expiresAt,
      },
    });
    console.log(
      `Activation code for ${email}: ${formatCode(code)} (valid until ${expiresAt.toISOString().slice(0, 10)}, enter it on /activation)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
