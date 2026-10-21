import { hash } from 'argon2';
import type { User } from '../src/generated/prisma/client';
import { scriptPrisma } from '../src/scripts/script-prisma';

// Demo data only, fake people. Every seeded account shares DEMO_PASSWORD.
const DEMO_PASSWORD = 'shobukan-demo';

const MEMBERS = [
  {
    firstName: 'Aiko',
    lastName: 'Martin',
    email: 'aiko.martin@example.com',
    phone: '06 12 34 56 78',
    directoryVisible: true,
  },
  {
    firstName: 'Julien',
    lastName: 'Moreau',
    email: 'julien.moreau@example.com',
    phone: '06 23 45 67 89',
    directoryVisible: true,
  },
  {
    firstName: 'Camille',
    lastName: 'Lefèvre',
    email: 'camille.lefevre@example.com',
    phone: '06 34 56 78 90',
    directoryVisible: true,
  },
  {
    firstName: 'Hugo',
    lastName: 'Bernard',
    email: 'hugo.bernard@example.com',
    phone: '06 45 67 89 01',
    directoryVisible: false,
  },
  {
    firstName: 'Sakura',
    lastName: 'Dubois',
    email: 'sakura.dubois@example.com',
    phone: '06 56 78 90 12',
    directoryVisible: true,
  },
];

const PLANS = [
  {
    name: 'Cotisation annuelle adulte',
    description: 'Accès à tous les cours adultes pour la saison.',
    amountCents: 25000,
    interval: 'YEAR' as const,
    sortOrder: 0,
  },
  {
    name: 'Cotisation mensuelle',
    description: 'Accès à tous les cours, sans engagement.',
    amountCents: 2500,
    interval: 'MONTH' as const,
    sortOrder: 1,
  },
];

async function main() {
  const prisma = scriptPrisma();
  try {
    const passwordHash = await hash(DEMO_PASSWORD);
    const users: User[] = [];
    for (const member of MEMBERS) {
      users.push(
        await prisma.user.upsert({
          where: { email: member.email },
          update: {},
          create: { ...member, passwordHash, termsAcceptedAt: new Date() },
        }),
      );
    }

    for (const plan of PLANS) {
      const existing = await prisma.plan.findFirst({
        where: { name: plan.name },
      });
      if (!existing) await prisma.plan.create({ data: plan });
    }

    const [aiko, julien] = users;
    const hasMessages = await prisma.message.count();
    if (!hasMessages) {
      await prisma.message.createMany({
        data: [
          {
            senderId: aiko.id,
            recipientId: julien.id,
            body: 'Salut Julien, tu viens au keiko de jeudi ?',
          },
          {
            senderId: julien.id,
            recipientId: aiko.id,
            body: 'Oui, je serai là à 20h.',
          },
        ],
      });
    }

    console.log(
      `Seeded ${users.length} members and ${PLANS.length} plans (password: ${DEMO_PASSWORD})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
