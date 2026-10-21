import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import type { SelfUser } from '../common/self-user';
import {
  CreateCodeInvitationDto,
  CreateJoinRequestDto,
  ListJoinRequestsQuery,
} from './onboarding.dto';
import {
  formatCode,
  generateCode,
  generateLinkToken,
  hashSecret,
  invitationStatus,
} from './invitation-codes';

const INVITATION_TTL_MS = 14 * 24 * 3600 * 1000;
const PAGE_SIZE = 50;

const invitationView = {
  id: true,
  kind: true,
  email: true,
  firstName: true,
  lastName: true,
  expiresAt: true,
  usedAt: true,
  revokedAt: true,
  failedAttempts: true,
  createdAt: true,
  createdBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.InvitationSelect;

// Rules: docs/onboarding.md.
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webUrl = config.getOrThrow<string>('webUrl');
  }

  // Join requests (public side)

  async createJoinRequest(dto: CreateJoinRequestDto): Promise<void> {
    if (dto.website) {
      this.logger.warn('Join request dropped by the honeypot');
      return;
    }
    const request = await this.prisma.joinRequest.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone ?? null,
        message: dto.message,
        wantsTrial: dto.wantsTrial,
      },
    });

    // Mail failures never fail the request: it is stored, the dashboard shows it.
    await this.safeSend({
      to: dto.email,
      subject: 'Shobukan Dojo : nous avons bien reçu votre message',
      text: [
        `Bonjour ${dto.firstName},`,
        '',
        'Merci pour votre intérêt pour le Shobukan Dojo. Votre message a bien été transmis au bureau, qui vous répondra rapidement.',
        ...(dto.wantsTrial
          ? ['', "Nous vous proposerons une date pour un cours d'essai."]
          : []),
        '',
        'À bientôt,',
        'Le bureau du Shobukan Dojo',
      ].join('\n'),
    });
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    });
    for (const admin of admins) {
      await this.safeSend({
        to: admin.email,
        subject: `Nouvelle demande : ${dto.firstName} ${dto.lastName}${dto.wantsTrial ? " (cours d'essai)" : ''}`,
        text: [
          `${dto.firstName} ${dto.lastName} souhaite rejoindre le dojo.`,
          `Cours d'essai souhaité : ${dto.wantsTrial ? 'oui' : 'non'}`,
          '',
          `Demande à traiter : ${this.webUrl}/admin/demandes/${request.id}`,
        ].join('\n'),
      });
    }
  }

  // Join requests (admin side)

  async listJoinRequests(query: ListJoinRequestsQuery) {
    const rows = await this.prisma.joinRequest.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      include: {
        invitation: { select: invitationView },
        handledBy: { select: { firstName: true, lastName: true } },
      },
    });
    const page = rows.slice(0, PAGE_SIZE);
    return {
      items: page.map((row) => this.withInvitationStatus(row)),
      nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1].id : null,
    };
  }

  async joinRequest(id: string) {
    const row = await this.prisma.joinRequest.findUnique({
      where: { id },
      include: {
        invitation: { select: invitationView },
        handledBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'join_request_not_found' });
    return this.withInvitationStatus(row);
  }

  async countNew(): Promise<{ count: number }> {
    return {
      count: await this.prisma.joinRequest.count({ where: { status: 'NEW' } }),
    };
  }

  async setJoinRequestStatus(
    admin: SelfUser,
    id: string,
    status: 'NEW' | 'DECLINED',
  ) {
    await this.joinRequest(id);
    await this.prisma.joinRequest.update({
      where: { id },
      data: { status, handledById: admin.id, handledAt: new Date() },
    });
    return this.joinRequest(id);
  }

  async deleteJoinRequest(id: string): Promise<void> {
    await this.joinRequest(id);
    await this.prisma.joinRequest.delete({ where: { id } });
  }

  // Sending again replaces the previous link: only the latest one works.
  async inviteFromJoinRequest(admin: SelfUser, id: string) {
    const request = await this.joinRequest(id);
    await this.assertNoAccount(request.email);

    const token = generateLinkToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.invitation.updateMany({
        where: { joinRequestId: id },
        data: { joinRequestId: null, revokedAt: new Date() },
      }),
      this.prisma.invitation.create({
        data: {
          kind: 'LINK',
          email: request.email,
          firstName: request.firstName,
          lastName: request.lastName,
          tokenHash: hashSecret(token),
          expiresAt,
          createdById: admin.id,
          joinRequestId: id,
        },
      }),
      this.prisma.joinRequest.update({
        where: { id },
        data: {
          status: 'INVITED',
          handledById: admin.id,
          handledAt: new Date(),
        },
      }),
    ]);

    const link = `${this.webUrl}/inscription?invitation=${token}`;
    const delivery = await this.safeSend({
      to: request.email,
      subject: 'Shobukan Dojo : votre lien d’inscription',
      text: [
        `Bonjour ${request.firstName},`,
        '',
        'Le bureau du Shobukan Dojo vous invite à créer votre compte de pratiquant :',
        link,
        '',
        `Ce lien est personnel et valable jusqu'au ${expiresAt.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}.`,
        '',
        'À bientôt sur le tatami,',
        'Le bureau du Shobukan Dojo',
      ].join('\n'),
    });
    // The admin gets the link too, to hand it over if the mail does not arrive.
    return { link, expiresAt, delivery };
  }

  // Codes for practitioners who already train at the dojo

  async createCodeInvitation(admin: SelfUser, dto: CreateCodeInvitationDto) {
    await this.assertNoAccount(dto.email);
    const code = generateCode();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    await this.prisma.$transaction([
      this.prisma.invitation.updateMany({
        where: {
          email: dto.email,
          kind: 'CODE',
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
      this.prisma.invitation.create({
        data: {
          kind: 'CODE',
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          tokenHash: hashSecret(code),
          expiresAt,
          createdById: admin.id,
        },
      }),
    ]);

    const display = formatCode(code);
    const delivery = await this.safeSend({
      to: dto.email,
      subject: 'Shobukan Dojo : votre code d’activation',
      text: [
        `Bonjour ${dto.firstName},`,
        '',
        'Votre espace pratiquant du Shobukan Dojo vous attend. Pour créer votre compte :',
        `1. Ouvrez ${this.webUrl}/activation`,
        `2. Saisissez cette adresse e-mail et le code ${display}`,
        '',
        `Ce code est personnel et valable jusqu'au ${expiresAt.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}.`,
        '',
        'Le bureau du Shobukan Dojo',
      ].join('\n'),
    });
    // Shown once to the admin, never stored in clear.
    return { code: display, expiresAt, delivery };
  }

  async listInvitations() {
    const rows = await this.prisma.invitation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { ...invitationView, joinRequestId: true },
    });
    return rows.map((row) => ({ ...row, status: invitationStatus(row) }));
  }

  async revokeInvitation(id: string): Promise<void> {
    const { count } = await this.prisma.invitation.updateMany({
      where: { id, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!count) throw new NotFoundException({ code: 'invitation_not_found' });
  }

  // Public preview of a link, to prefill the signup form.
  async previewLink(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashSecret(token) },
      select: { ...invitationView },
    });
    if (
      !invitation ||
      invitation.kind !== 'LINK' ||
      invitationStatus(invitation) !== 'PENDING'
    ) {
      throw new NotFoundException({ code: 'invalid_invitation' });
    }
    return {
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      expiresAt: invitation.expiresAt,
    };
  }

  private withInvitationStatus<
    T extends {
      invitation: Prisma.InvitationGetPayload<{
        select: typeof invitationView;
      }> | null;
    },
  >(row: T) {
    return {
      ...row,
      invitation: row.invitation
        ? { ...row.invitation, status: invitationStatus(row.invitation) }
        : null,
    };
  }

  private async assertNoAccount(email: string): Promise<void> {
    const exists = await this.prisma.user.count({ where: { email } });
    if (exists) throw new ConflictException({ code: 'email_taken' });
  }

  private async safeSend(mail: { to: string; subject: string; text: string }) {
    try {
      return await this.mail.send(mail);
    } catch (error) {
      this.logger.error(
        `Mail failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 'failed' as const;
    }
  }
}
