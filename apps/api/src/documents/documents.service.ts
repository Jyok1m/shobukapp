import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, sniffMime } from '../storage/storage.service';
import type { SelfUser } from '../common/self-user';
import {
  CreateDojoDocumentDto,
  CreateMemberDocumentDto,
  UpdateDocumentDto,
  UpsertLicenseDto,
} from './dto/documents.dto';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const documentSelect = {
  id: true,
  ownerId: true,
  category: true,
  title: true,
  mimeType: true,
  sizeBytes: true,
  validUntil: true,
  placement: true,
  description: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentSelect;

const licenseSelect = {
  id: true,
  userId: true,
  season: true,
  discipline: true,
  number: true,
  storageKey: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LicenseSelect;

export type DownloadableFile = {
  stream: Readable;
  mimeType: string;
  filename: string;
};

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

// The only extension we ever put in a filename is derived from the sniffed type.
const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function safeFilename(title: string, mimeType: string): string {
  const base =
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'document';
  return `${base}.${EXTENSIONS[mimeType] ?? 'bin'}`;
}

// Rules: docs/documents.md. A foreign document answers 404, never 403.
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  listMine(userId: string) {
    return this.prisma.document.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      select: documentSelect,
    });
  }

  listDojo() {
    return this.prisma.document.findMany({
      where: { ownerId: null },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
      select: documentSelect,
    });
  }

  /*
   * The dojo's published documents, for every signed-in member: the
   * announcement board and the important documents (docs/documents.md).
   */
  async board() {
    const rows = await this.prisma.document.findMany({
      where: { ownerId: null, placement: { not: 'PRIVATE' } },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: documentSelect,
    });
    return {
      announcements: rows.filter((d) => d.placement === 'ANNOUNCEMENT'),
      important: rows.filter((d) => d.placement === 'IMPORTANT'),
    };
  }

  createForMember(
    user: SelfUser,
    dto: CreateMemberDocumentDto,
    file?: Express.Multer.File,
  ) {
    return this.create(user.id, user.id, dto, file);
  }

  createForDojo(
    admin: SelfUser,
    dto: CreateDojoDocumentDto,
    file?: Express.Multer.File,
  ) {
    return this.create(null, admin.id, dto, file);
  }

  async update(viewer: SelfUser, id: string, dto: UpdateDocumentDto) {
    const doc = await this.findAccessible(viewer, id, 'write');
    const publishing =
      dto.placement !== undefined || dto.description !== undefined;
    if (publishing && (doc.ownerId !== null || viewer.role !== 'ADMIN')) {
      // A member's document (a medical certificate) is never published.
      throw new BadRequestException({ code: 'not_publishable' });
    }
    return this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.validUntil !== undefined && {
          validUntil: toDate(dto.validUntil),
        }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.placement !== undefined && {
          placement: dto.placement,
          publishedAt:
            dto.placement === 'PRIVATE'
              ? null
              : doc.placement === 'PRIVATE'
                ? new Date()
                : doc.publishedAt,
        }),
      },
      select: documentSelect,
    });
  }

  async remove(viewer: SelfUser, id: string): Promise<void> {
    const doc = await this.findAccessible(viewer, id, 'write');
    await this.prisma.document.delete({ where: { id } });
    await this.storage.remove(doc.storageKey);
  }

  async file(viewer: SelfUser, id: string): Promise<DownloadableFile> {
    const doc = await this.findAccessible(viewer, id, 'read');
    return {
      stream: await this.storage.get(doc.storageKey),
      mimeType: doc.mimeType,
      filename: safeFilename(doc.title, doc.mimeType),
    };
  }

  // Licences

  listMyLicenses(userId: string) {
    return this.licenses({ userId });
  }

  async licenses(where: Prisma.LicenseWhereInput) {
    const rows = await this.prisma.license.findMany({
      where,
      orderBy: [{ season: 'desc' }, { discipline: 'asc' }],
      select: licenseSelect,
    });
    return rows.map(({ storageKey, ...license }) => ({
      ...license,
      hasFile: Boolean(storageKey),
    }));
  }

  async upsertLicense(
    admin: SelfUser,
    dto: UpsertLicenseDto,
    file?: Express.Multer.File,
  ) {
    const exists = await this.prisma.user.count({ where: { id: dto.userId } });
    if (!exists) throw new NotFoundException({ code: 'member_not_found' });

    const key = file
      ? await this.store(file, [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
        ])
      : null;
    const unique = {
      userId_season_discipline: {
        userId: dto.userId,
        season: dto.season,
        discipline: dto.discipline,
      },
    };
    const previous = await this.prisma.license.findUnique({
      where: unique,
      select: { storageKey: true },
    });
    let license: Prisma.LicenseGetPayload<{ select: typeof licenseSelect }>;
    try {
      license = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.license.upsert({
          where: unique,
          create: {
            userId: dto.userId,
            season: dto.season,
            discipline: dto.discipline,
            number: dto.number,
            storageKey: key?.key ?? null,
            uploadedById: admin.id,
          },
          update: {
            number: dto.number,
            uploadedById: admin.id,
            ...(key && { storageKey: key.key }),
          },
          select: licenseSelect,
        });
        // The number belongs to the season: the other disciplines follow it.
        await tx.license.updateMany({
          where: { userId: dto.userId, season: dto.season },
          data: { number: dto.number },
        });
        // Only the file proves the licence is in: a renewal keeps last season's number.
        if (key) {
          await tx.licenseRequest.updateMany({
            where: {
              userId: dto.userId,
              season: dto.season,
              discipline: dto.discipline,
              status: { not: 'DONE' },
            },
            data: { status: 'DONE', doneAt: new Date() },
          });
        }
        return saved;
      });
    } catch (error) {
      if (key) await this.storage.remove(key.key);
      throw error;
    }
    // Outside the try: the row now points to the new file, which must survive.
    if (key && previous?.storageKey) {
      await this.storage.remove(previous.storageKey);
    }
    const { storageKey, ...rest } = license;
    return { ...rest, hasFile: Boolean(storageKey) };
  }

  async removeLicense(id: string): Promise<void> {
    const license = await this.prisma.license.findUnique({ where: { id } });
    if (!license) throw new NotFoundException({ code: 'not_found' });
    await this.prisma.license.delete({ where: { id } });
    if (license.storageKey) await this.storage.remove(license.storageKey);
  }

  async licenseFile(viewer: SelfUser, id: string): Promise<DownloadableFile> {
    const license = await this.prisma.license.findUnique({ where: { id } });
    const allowed =
      license &&
      license.storageKey &&
      (license.userId === viewer.id || viewer.role === 'ADMIN');
    if (!allowed) throw new NotFoundException({ code: 'not_found' });
    const buffer = await this.storage.read(license.storageKey!);
    const mimeType = sniffMime(buffer) ?? 'application/octet-stream';
    return {
      stream: Readable.from(buffer),
      mimeType,
      filename: safeFilename(
        `licence-ffjda-${license.season}-${license.discipline.toLowerCase()}`,
        mimeType,
      ),
    };
  }

  // Internals

  private async create(
    ownerId: string | null,
    uploaderId: string,
    dto: CreateMemberDocumentDto | CreateDojoDocumentDto,
    file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException({ code: 'file_required' });
    const { key, mimeType } = await this.store(file, Object.keys(EXTENSIONS));
    try {
      return await this.prisma.document.create({
        data: {
          ownerId,
          uploadedById: uploaderId,
          category: dto.category,
          title: dto.title,
          validUntil: toDate(dto.validUntil) ?? null,
          ...('placement' in dto &&
            ownerId === null && {
              placement: dto.placement ?? 'PRIVATE',
              description: dto.description ?? null,
              publishedAt:
                dto.placement && dto.placement !== 'PRIVATE'
                  ? new Date()
                  : null,
            }),
          storageKey: key,
          mimeType,
          sizeBytes: file.size,
        },
        select: documentSelect,
      });
    } catch (error) {
      // No row points to the file: remove it, or erasure would miss it.
      await this.storage.remove(key);
      throw error;
    }
  }

  private async store(
    file: Express.Multer.File,
    allowed: string[],
  ): Promise<{ key: string; mimeType: string }> {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException({ code: 'file_too_large' });
    }
    const mimeType = sniffMime(file.buffer);
    if (!mimeType || !allowed.includes(mimeType)) {
      throw new BadRequestException({ code: 'unsupported_file_type' });
    }
    return { key: await this.storage.put(file.buffer), mimeType };
  }

  /*
   * Member documents: owner or admin. Dojo documents (no owner): admins only.
   * Anything else is reported as missing, so ids do not reveal existence.
   */
  private async findAccessible(
    viewer: SelfUser,
    id: string,
    access: 'read' | 'write',
  ) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    const allowed =
      doc &&
      (viewer.role === 'ADMIN' ||
        (doc.ownerId !== null && doc.ownerId === viewer.id) ||
        // A published dojo document is readable by every member, never editable.
        (access === 'read' &&
          doc.ownerId === null &&
          doc.placement !== 'PRIVATE'));
    if (!allowed) throw new NotFoundException({ code: 'not_found' });
    return doc;
  }
}
