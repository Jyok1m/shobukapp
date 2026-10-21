import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  ACTIVE_STATUSES,
  LATE_STATUSES,
  MEMBER_STATUSES,
  pickCurrent,
} from '../billing/subscriptions.service';
import { selfUserSelect, SelfUser } from '../common/self-user';
import { toProfileData } from '../users/users.service';
import { UpdateProfileDto } from '../users/dto/profile.dto';
import { ErasureService } from './erasure.service';
import { ListMembersQuery, MembershipFilter } from './dto/admin-members.dto';

const PAGE_SIZE = 50;

const listSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  createdAt: true,
  subscriptions: {
    select: {
      status: true,
      createdAt: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      plan: { select: { name: true } },
    },
  },
  payments: {
    where: { status: 'PAID' },
    orderBy: { paidAt: 'desc' },
    take: 1,
    select: { paidAt: true, amountCents: true, currency: true },
  },
  remindersReceived: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { createdAt: true },
  },
  documents: {
    where: { category: 'MEDICAL_CERTIFICATE' },
    orderBy: { validUntil: { sort: 'desc', nulls: 'last' } },
    take: 1,
    select: { validUntil: true },
  },
  _count: { select: { payments: { where: { status: 'FAILED' } } } },
} satisfies Prisma.UserSelect;

type ListRow = Prisma.UserGetPayload<{ select: typeof listSelect }>;

function membershipWhere(filter?: MembershipFilter): Prisma.UserWhereInput {
  switch (filter) {
    case 'active':
      return { subscriptions: { some: { status: { in: ACTIVE_STATUSES } } } };
    case 'past_due':
      return {
        subscriptions: {
          some: { status: { in: LATE_STATUSES } },
          none: { status: { in: ACTIVE_STATUSES } },
        },
      };
    case 'none':
      return {
        subscriptions: {
          none: { status: { in: [...ACTIVE_STATUSES, ...LATE_STATUSES] } },
        },
      };
    default:
      return {};
  }
}

function toListItem(row: ListRow) {
  const subscription = pickCurrent(row.subscriptions);
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    role: row.role,
    createdAt: row.createdAt,
    membership: {
      status: subscription?.status ?? null,
      isMember: MEMBER_STATUSES.includes(subscription?.status ?? ''),
      planName: subscription?.plan?.name ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    },
    lastPayment: row.payments[0] ?? null,
    failedPayments: row._count.payments,
    lastReminderAt: row.remindersReceived[0]?.createdAt ?? null,
    // Only the date: the certificate itself stays behind its own route.
    medicalCertificate: row.documents[0]
      ? { validUntil: row.documents[0].validUntil }
      : null,
  };
}

// A cell starting with these is run as a formula by spreadsheet software.
function csvCell(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text =
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const SEX_LABEL = { FEMALE: 'F', MALE: 'M' } as const;

@Injectable()
export class AdminMembersService {
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly erasure: ErasureService,
    config: ConfigService,
  ) {
    this.webUrl = config.getOrThrow<string>('webUrl');
  }

  async list(query: ListMembersQuery) {
    const where: Prisma.UserWhereInput = {
      ...membershipWhere(query.status),
      ...(query.q && {
        OR: [
          { firstName: { contains: query.q, mode: 'insensitive' } },
          { lastName: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const rows = await this.prisma.user.findMany({
      where,
      select: listSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      take: PAGE_SIZE + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });
    const page = rows.slice(0, PAGE_SIZE);
    return {
      items: page.map(toListItem),
      nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    };
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...selfUserSelect,
        subscriptions: {
          orderBy: { updatedAt: 'desc' },
          select: {
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            createdAt: true,
            plan: { select: { name: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 24,
          select: {
            id: true,
            amountCents: true,
            currency: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },
        },
        remindersReceived: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            note: true,
            createdAt: true,
            sentBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException({ code: 'member_not_found' });
    const current = pickCurrent(user.subscriptions);
    return {
      ...user,
      membership: {
        status: current?.status ?? null,
        isMember: MEMBER_STATUSES.includes(current?.status ?? ''),
        planName: current?.plan?.name ?? null,
        currentPeriodEnd: current?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: current?.cancelAtPeriodEnd ?? false,
      },
    };
  }

  async update(id: string, dto: UpdateProfileDto): Promise<SelfUser> {
    await this.assertExists(id);
    return this.prisma.user.update({
      where: { id },
      data: toProfileData(dto),
      select: selfUserSelect,
    });
  }

  async remove(adminId: string, id: string): Promise<void> {
    // An admin erases themself elsewhere: the dashboard must not close its own door.
    if (adminId === id) {
      throw new BadRequestException({ code: 'cannot_delete_self' });
    }
    await this.erasure.erase(id);
  }

  async remind(adminId: string, id: string, note?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { email: true, firstName: true },
    });
    if (!user) throw new NotFoundException({ code: 'member_not_found' });

    const delivery = await this.mail.send({
      to: user.email,
      subject: 'Shobukan Dojo : votre cotisation',
      text: [
        `Bonjour ${user.firstName},`,
        '',
        "Sauf erreur de notre part, votre cotisation au Shobukan Dojo n'est pas à jour.",
        `Vous pouvez la régler ou mettre à jour votre moyen de paiement ici : ${this.webUrl}/abonnement`,
        ...(note ? ['', note] : []),
        '',
        'Merci, et à bientôt sur le tatami.',
        'Le bureau du Shobukan Dojo',
      ].join('\n'),
    });
    const reminder = await this.prisma.paymentReminder.create({
      data: { userId: id, sentById: adminId, note: note ?? null },
      select: { id: true, createdAt: true, note: true },
    });
    return { ...reminder, delivery };
  }

  async exportCsv(adminId: string): Promise<string> {
    const users = await this.prisma.user.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        lastName: true,
        firstName: true,
        email: true,
        phone: true,
        birthDate: true,
        sex: true,
        nationality: true,
        addressLine: true,
        postalCode: true,
        city: true,
        country: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        createdAt: true,
        subscriptions: {
          select: {
            status: true,
            createdAt: true,
            currentPeriodEnd: true,
            plan: { select: { name: true } },
          },
        },
        licenses: {
          orderBy: { season: 'desc' },
          take: 1,
          select: { season: true, number: true },
        },
      },
    });

    const header = [
      'Nom',
      'Prénom',
      'Email',
      'Téléphone',
      'Date de naissance',
      'Sexe',
      'Nationalité',
      'Adresse',
      'Code postal',
      'Ville',
      'Pays',
      "Contact d'urgence",
      "Téléphone d'urgence",
      'Statut abonnement',
      'Formule',
      'Fin de période',
      'Saison licence',
      'Numéro de licence',
      'Inscrit le',
    ];
    const lines = users.map((u) => {
      const sub = pickCurrent(u.subscriptions);
      const license = u.licenses[0];
      return [
        u.lastName,
        u.firstName,
        u.email,
        u.phone,
        u.birthDate,
        u.sex ? SEX_LABEL[u.sex] : null,
        u.nationality,
        u.addressLine,
        u.postalCode,
        u.city,
        u.country,
        u.emergencyContactName,
        u.emergencyContactPhone,
        sub?.status,
        sub?.plan?.name,
        sub?.currentPeriodEnd,
        license?.season,
        license?.number,
        u.createdAt,
      ]
        .map(csvCell)
        .join(';');
    });

    await this.prisma.memberExport.create({
      data: { exportedById: adminId, rowCount: users.length },
    });
    // BOM: Excel reads accents correctly; CRLF and semicolons for French Excel.
    return '﻿' + [header.map(csvCell).join(';'), ...lines].join('\r\n');
  }

  private async assertExists(id: string): Promise<void> {
    const found = await this.prisma.user.count({ where: { id } });
    if (!found) throw new NotFoundException({ code: 'member_not_found' });
  }
}
