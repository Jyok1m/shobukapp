import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type {
  Discipline,
  LicenseRequestStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { SelfUser } from '../common/self-user';
import { SEX_LABEL, toCsv } from '../common/csv';
import {
  CreateLicenseRequestsDto,
  ExportLicenseRequestsQuery,
  ListLicenseRequestsQuery,
  UpdateLicenseRequestDto,
} from './dto/license-requests.dto';

const DEFAULT_LIMIT = 50;

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  KENDO: 'Kendo',
  IAIDO: 'Iaido',
  JODO: 'Jodo',
  BATTODO: 'Battodo',
};

const STATUS_LABEL: Record<LicenseRequestStatus, string> = {
  PENDING: 'À faire',
  SENT: 'Envoyée',
  DONE: 'Reçue',
};

// The profile fields the FFJDA extranet asks for. Never the password hash.
const itemSelect = {
  id: true,
  userId: true,
  season: true,
  discipline: true,
  status: true,
  note: true,
  sentAt: true,
  doneAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      birthDate: true,
      sex: true,
      nationality: true,
      addressLine: true,
      postalCode: true,
      city: true,
    },
  },
} satisfies Prisma.LicenseRequestSelect;

type ItemRow = Prisma.LicenseRequestGetPayload<{ select: typeof itemSelect }>;

export type MissingField = 'birthDate' | 'sex' | 'nationality' | 'address';

const blank = (value: string | null) => !value || !value.trim();

export function missingFields(user: ItemRow['user']): MissingField[] {
  const missing: MissingField[] = [];
  if (!user.birthDate) missing.push('birthDate');
  if (!user.sex) missing.push('sex');
  if (blank(user.nationality)) missing.push('nationality');
  if (blank(user.addressLine) || blank(user.postalCode) || blank(user.city)) {
    missing.push('address');
  }
  return missing;
}

function toItem({ user, ...request }: ItemRow) {
  return {
    ...request,
    member: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    missingFields: missingFields(user),
  };
}

/*
 * The season's own number, else the latest earlier one (a renewal keeps the
 * FFJDA number). Seasons "YYYY-YYYY" sort as strings.
 */
export function licenseNumberFor(
  licenses: { season: string; number: string }[],
  season: string,
): string | null {
  const own = licenses.find((l) => l.season === season);
  if (own) return own.number;
  const earlier = licenses
    .filter((l) => l.season < season)
    .sort((a, b) => b.season.localeCompare(a.season));
  return earlier[0]?.number ?? null;
}

// FFJDA licence requests typed by hand on the federation extranet (docs/documents.md).
@Injectable()
export class LicenseRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListLicenseRequestsQuery) {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const rows = await this.prisma.licenseRequest.findMany({
      where: {
        ...(query.season && { season: query.season }),
        ...(query.status && { status: query.status }),
        ...(query.userId && { userId: query.userId }),
      },
      select: itemSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map(toItem),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }

  /*
   * One PENDING request per discipline. A discipline that already has a
   * request or a licence for the season is skipped, not an error.
   */
  async create(admin: SelfUser, dto: CreateLicenseRequestsDto) {
    const exists = await this.prisma.user.count({ where: { id: dto.userId } });
    if (!exists) throw new NotFoundException({ code: 'member_not_found' });

    const where = {
      userId: dto.userId,
      season: dto.season,
      discipline: { in: dto.disciplines },
    };
    const [requests, licenses] = await Promise.all([
      this.prisma.licenseRequest.findMany({
        where,
        select: { discipline: true },
      }),
      this.prisma.license.findMany({
        where: { ...where, storageKey: { not: null } },
        select: { discipline: true },
      }),
    ]);
    const taken = new Set(
      [...requests, ...licenses].map((row) => row.discipline),
    );

    const created: ReturnType<typeof toItem>[] = [];
    const skipped: Discipline[] = [];
    for (const discipline of dto.disciplines) {
      if (taken.has(discipline)) {
        skipped.push(discipline);
        continue;
      }
      try {
        const row = await this.prisma.licenseRequest.create({
          data: {
            userId: dto.userId,
            season: dto.season,
            discipline,
            note: dto.note ?? null,
            requestedById: admin.id,
          },
          select: itemSelect,
        });
        created.push(toItem(row));
      } catch (error) {
        // Another admin created it in between: same outcome as a skip.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          skipped.push(discipline);
          continue;
        }
        throw error;
      }
    }
    return { created, skipped };
  }

  async update(id: string, dto: UpdateLicenseRequestDto) {
    const current = await this.prisma.licenseRequest.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) throw new NotFoundException({ code: 'not_found' });

    const statusData =
      dto.status === undefined || dto.status === current.status
        ? {}
        : {
            status: dto.status,
            sentAt: dto.status === 'SENT' ? new Date() : null,
          };
    const data = {
      ...statusData,
      ...(dto.note !== undefined && { note: dto.note }),
    };
    // The status guard is in the write: a licence uploaded meanwhile wins.
    const { count } = Object.keys(data).length
      ? await this.prisma.licenseRequest.updateMany({
          where: { id, status: { not: 'DONE' } },
          data,
        })
      : { count: current.status === 'DONE' ? 0 : 1 };
    if (!count) {
      const still = await this.prisma.licenseRequest.count({ where: { id } });
      if (!still) throw new NotFoundException({ code: 'not_found' });
      throw new ConflictException({ code: 'license_request_done' });
    }
    return toItem(
      await this.prisma.licenseRequest.findUniqueOrThrow({
        where: { id },
        select: itemSelect,
      }),
    );
  }

  async remove(id: string): Promise<void> {
    const { count } = await this.prisma.licenseRequest.deleteMany({
      where: { id },
    });
    if (!count) throw new NotFoundException({ code: 'not_found' });
  }

  /*
   * What the admin types on the FFJDA extranet. Never the emergency contact
   * nor anything medical. Journaled like the members export (docs/privacy.md).
   */
  async exportCsv(
    adminId: string,
    query: ExportLicenseRequestsQuery,
  ): Promise<string> {
    const requests = await this.prisma.licenseRequest.findMany({
      where: {
        ...(query.season && { season: query.season }),
        ...(query.status && { status: query.status }),
      },
      orderBy: [
        { user: { lastName: 'asc' } },
        { user: { firstName: 'asc' } },
        { userId: 'asc' },
        { discipline: 'asc' },
        { season: 'asc' },
      ],
      select: {
        season: true,
        discipline: true,
        status: true,
        user: {
          select: {
            lastName: true,
            firstName: true,
            sex: true,
            birthDate: true,
            nationality: true,
            addressLine: true,
            postalCode: true,
            city: true,
            country: true,
            email: true,
            phone: true,
            licenses: { select: { season: true, number: true } },
          },
        },
      },
    });

    const header = [
      'Nom',
      'Prénom',
      'Sexe',
      'Date de naissance',
      'Nationalité',
      'Adresse',
      'Code postal',
      'Ville',
      'Pays',
      'Email',
      'Téléphone',
      'Saison',
      'Discipline',
      'Numéro de licence',
      'Statut',
    ];
    const rows = requests.map(({ user: u, ...r }) => [
      u.lastName,
      u.firstName,
      u.sex ? SEX_LABEL[u.sex] : null,
      u.birthDate,
      u.nationality,
      u.addressLine,
      u.postalCode,
      u.city,
      u.country,
      u.email,
      u.phone,
      r.season,
      DISCIPLINE_LABEL[r.discipline],
      licenseNumberFor(u.licenses, r.season),
      STATUS_LABEL[r.status],
    ]);

    await this.prisma.memberExport.create({
      data: {
        exportedById: adminId,
        kind: 'LICENSE_REQUESTS',
        rowCount: requests.length,
      },
    });
    return toCsv(header, rows);
  }
}
