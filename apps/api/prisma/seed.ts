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

// The dojo's 2026/2027 grid (1 unité = 1 discipline, once a week). One-time
// fees (entrance, FFJDA licence, sports passport) are not cotisations.
const PLANS = [
  { name: 'Adulte · 1 unité par semaine', quarter: 24000, year: 73500 },
  { name: 'Adulte · 2 unités par semaine', quarter: 33000, year: 99600 },
  { name: 'Adulte · 3 unités par semaine', quarter: 37500, year: 110400 },
  { name: 'Adulte · à volonté', quarter: 45000, year: 132000 },
  { name: 'Enfant (jusqu’à 14 ans) · 1 unité par semaine', quarter: 14500 },
  { name: 'Enfant (jusqu’à 14 ans) · 2 unités par semaine', quarter: 19500 },
].map((plan, sortOrder) => ({
  name: plan.name,
  description: plan.name.startsWith('Enfant')
    ? 'Iaido, kendo, battodo, jojutsu ou fuzokubudo. Droit d’entrée annuel : 45 €.'
    : 'Iaido, kendo, battodo, jojutsu ou fuzokubudo. Droit d’entrée annuel : 60 €.',
  sortOrder,
  prices: [
    ...(plan.year
      ? [{ frequency: 'YEAR' as const, amountCents: plan.year }]
      : []),
    { frequency: 'QUARTER' as const, amountCents: plan.quarter },
  ],
}));

async function main() {
  const prisma = scriptPrisma('local');
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
      if (!existing) {
        await prisma.plan.create({
          data: { ...plan, prices: { create: plan.prices } },
        });
      }
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

    /*
     * Demo billing states. The sub_demo_ ids do not exist at Stripe: erasing
     * these members needs a configured Stripe key, which answers
     * resource_missing, treated as already cancelled.
     */
    const [, , camille, hugo, sakura] = users;
    const adult = await prisma.plan.findFirst({
      where: { name: PLANS[0].name },
    });
    const yearAhead = new Date(Date.now() + 300 * 24 * 3600 * 1000);
    const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const states = [
      {
        user: camille,
        frequency: 'YEAR',
        amount: 25000,
        status: 'active',
        end: yearAhead,
      },
      {
        user: sakura,
        frequency: 'QUARTER',
        amount: 7000,
        status: 'active',
        end: yearAhead,
      },
      {
        user: hugo,
        frequency: 'MONTH',
        amount: 2500,
        status: 'past_due',
        end: lastWeek,
      },
    ] as const;
    for (const { user, frequency, amount, status, end } of states) {
      const stripeSubscriptionId = `sub_demo_${user.id.slice(0, 8)}`;
      await prisma.subscription.upsert({
        where: { stripeSubscriptionId },
        update: {},
        create: {
          userId: user.id,
          planId: adult?.id ?? null,
          frequency,
          stripeSubscriptionId,
          status,
          currentPeriodEnd: end,
        },
      });
      await prisma.payment.upsert({
        where: { stripeInvoiceId: `in_demo_${user.id.slice(0, 8)}` },
        update: {},
        create: {
          userId: user.id,
          stripeInvoiceId: `in_demo_${user.id.slice(0, 8)}`,
          amountCents: amount,
          status: status === 'active' ? 'PAID' : 'FAILED',
          paidAt: status === 'active' ? lastWeek : null,
        },
      });
    }

    for (const user of [camille, sakura]) {
      await prisma.license.upsert({
        where: { userId_season: { userId: user.id, season: '2026-2027' } },
        update: {},
        create: {
          userId: user.id,
          season: '2026-2027',
          number: `DEMO-2026-0${users.indexOf(user)}`,
        },
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
