import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SelfUser } from '../common/self-user';

const PAGE_SIZE = 50;
// Conversations are built from the most recent messages: enough for a dojo.
const RECENT_WINDOW = 1000;

const counterpartSelect = {
  id: true,
  firstName: true,
  lastName: true,
  role: true,
  photoKey: true,
  directoryVisible: true,
} as const;

type CounterpartRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: 'PRACTITIONER' | 'ADMIN';
  photoKey: string | null;
  directoryVisible: boolean;
};

const messageSelect = {
  id: true,
  senderId: true,
  recipientId: true,
  body: true,
  readAt: true,
  createdAt: true,
} as const;

// Rules: docs/messaging.md.
@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async conversations(me: SelfUser) {
    const recent = await this.prisma.message.findMany({
      where: { OR: [{ senderId: me.id }, { recipientId: me.id }] },
      orderBy: { createdAt: 'desc' },
      take: RECENT_WINDOW,
      select: messageSelect,
    });
    const lastByCounterpart = new Map<string, (typeof recent)[number]>();
    for (const message of recent) {
      const other =
        message.senderId === me.id ? message.recipientId : message.senderId;
      if (!lastByCounterpart.has(other)) lastByCounterpart.set(other, message);
    }

    const ids = [...lastByCounterpart.keys()];
    const [people, unread] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: counterpartSelect,
      }),
      this.prisma.message.groupBy({
        by: ['senderId'],
        where: { recipientId: me.id, readAt: null, senderId: { in: ids } },
        _count: { _all: true },
      }),
    ]);
    const unreadBy = new Map(unread.map((u) => [u.senderId, u._count._all]));
    const byId = new Map(people.map((p) => [p.id, p]));

    return ids
      .filter((id) => byId.has(id))
      .map((id) => ({
        counterpart: this.counterpart(me, byId.get(id)!),
        lastMessage: lastByCounterpart.get(id)!,
        unread: unreadBy.get(id) ?? 0,
      }));
  }

  async thread(me: SelfUser, otherId: string, cursor?: string) {
    const other = await this.prisma.user.findUnique({
      where: { id: otherId },
      select: counterpartSelect,
    });
    if (!other) throw new NotFoundException({ code: 'member_not_found' });
    const canWrite = await this.canWrite(me, otherId, other);
    // Without a way to write nor a shared history, the person stays unknown:
    // an unlisted member's name must not leak through a guessed id.
    if (!canWrite) {
      const shared = await this.prisma.message.count({
        where: {
          OR: [
            { senderId: me.id, recipientId: otherId },
            { senderId: otherId, recipientId: me.id },
          ],
        },
      });
      if (!shared) throw new NotFoundException({ code: 'member_not_found' });
    }

    const rows = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: me.id, recipientId: otherId },
          { senderId: otherId, recipientId: me.id },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: messageSelect,
    });
    const page = rows.slice(0, PAGE_SIZE);
    return {
      counterpart: this.counterpart(me, other),
      canWrite,
      items: page,
      nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    };
  }

  async send(me: SelfUser, recipientId: string, body: string) {
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: counterpartSelect,
    });
    if (
      !recipient ||
      recipientId === me.id ||
      !(await this.canWrite(me, recipientId, recipient))
    ) {
      throw new NotFoundException({ code: 'member_not_found' });
    }
    return this.prisma.message.create({
      data: { senderId: me.id, recipientId, body },
      select: messageSelect,
    });
  }

  async markRead(me: SelfUser, otherId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.message.updateMany({
      where: { senderId: otherId, recipientId: me.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  async unreadCount(me: SelfUser): Promise<{ unread: number }> {
    const unread = await this.prisma.message.count({
      where: { recipientId: me.id, readAt: null },
    });
    return { unread };
  }

  /*
   * A practitioner writes to listed members and to admins, and can always
   * answer someone who wrote to them. Admins write to anyone.
   */
  private async canWrite(
    me: SelfUser,
    otherId: string,
    other: CounterpartRow,
  ): Promise<boolean> {
    if (otherId === me.id) return false;
    if (
      me.role === 'ADMIN' ||
      other.role === 'ADMIN' ||
      other.directoryVisible
    ) {
      return true;
    }
    const received = await this.prisma.message.count({
      where: { senderId: otherId, recipientId: me.id },
    });
    return received > 0;
  }

  // Same visibility rule as /members/:id/photo.
  private counterpart(me: SelfUser, row: CounterpartRow) {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      isAdmin: row.role === 'ADMIN',
      hasPhoto:
        Boolean(row.photoKey) && (row.directoryVisible || me.role === 'ADMIN'),
    };
  }
}
