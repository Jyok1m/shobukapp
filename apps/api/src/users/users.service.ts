import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, sniffMime } from '../storage/storage.service';
import { selfUserSelect, SelfUser } from '../common/self-user';
import { UpdateProfileDto } from './dto/profile.dto';

// What any signed-in user may see of another member: docs/members.md.
export const directorySelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  photoKey: true,
} satisfies Prisma.UserSelect;

export type DirectoryEntry = Omit<
  Prisma.UserGetPayload<{ select: typeof directorySelect }>,
  'photoKey'
> & { hasPhoto: boolean };

const PAGE_SIZE = 50;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export function toProfileData(
  dto: UpdateProfileDto & { directoryVisible?: boolean },
): Prisma.UserUpdateInput {
  const { birthDate, ...rest } = dto;
  return {
    ...rest,
    ...(birthDate !== undefined && {
      birthDate: birthDate === null ? null : new Date(birthDate),
    }),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  updateProfile(
    userId: string,
    dto: UpdateProfileDto & { directoryVisible?: boolean },
  ): Promise<SelfUser> {
    return this.prisma.user.update({
      where: { id: userId },
      data: toProfileData(dto),
      select: selfUserSelect,
    });
  }

  async setPhoto(userId: string, buffer: Buffer): Promise<SelfUser> {
    if (buffer.length > PHOTO_MAX_BYTES) {
      throw new BadRequestException({ code: 'file_too_large' });
    }
    const mime = sniffMime(buffer);
    if (!mime || mime === 'application/pdf') {
      throw new BadRequestException({ code: 'unsupported_file_type' });
    }
    const key = await this.storage.put(buffer);
    const { photoKey: previous } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { photoKey: true },
    });
    let user: SelfUser;
    try {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { photoKey: key },
        select: selfUserSelect,
      });
    } catch (error) {
      // No row points to the new file: remove it, or erasure would miss it.
      await this.storage.remove(key);
      throw error;
    }
    if (previous) await this.storage.remove(previous);
    return user;
  }

  async removePhoto(userId: string): Promise<SelfUser> {
    const { photoKey } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { photoKey: true },
    });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { photoKey: null },
      select: selfUserSelect,
    });
    if (photoKey) await this.storage.remove(photoKey);
    return user;
  }

  async directory(
    cursor?: string,
  ): Promise<{ items: DirectoryEntry[]; nextCursor: string | null }> {
    const rows = await this.prisma.user.findMany({
      where: { directoryVisible: true },
      select: directorySelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      take: PAGE_SIZE + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    const page = rows.slice(0, PAGE_SIZE);
    return {
      items: page.map(({ photoKey, ...entry }) => ({
        ...entry,
        hasPhoto: Boolean(photoKey),
      })),
      nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    };
  }

  // Visible to the owner, to admins, and to everyone if listed in the directory.
  async photo(
    viewer: SelfUser,
    userId: string,
  ): Promise<{ buffer: Buffer; mime: string }> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { photoKey: true, directoryVisible: true },
    });
    const allowed =
      target &&
      (target.directoryVisible ||
        viewer.id === userId ||
        viewer.role === 'ADMIN');
    if (!allowed || !target.photoKey) {
      throw new NotFoundException({ code: 'not_found' });
    }
    const buffer = await this.storage.read(target.photoKey);
    return { buffer, mime: sniffMime(buffer) ?? 'application/octet-stream' };
  }
}
