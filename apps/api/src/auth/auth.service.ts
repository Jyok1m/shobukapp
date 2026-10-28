import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { selfUserSelect, SelfUser } from '../common/self-user';
import { MailService } from '../mail/mail.service';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import {
  generateLinkToken,
  hashSecret,
  invitationStatus,
  normalizeCode,
} from '../onboarding/invitation-codes';

const RESET_TTL_MS = 60 * 60 * 1000;

// The only service allowed to select password_hash (docs/auth.md).
@Injectable()
export class AuthService implements OnModuleInit {
  // Verified against when the email is unknown, so both failures take as long.
  private dummyHash = '';
  private readonly logger = new Logger(AuthService.name);
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.webUrl = config.getOrThrow<string>('webUrl');
  }

  async onModuleInit() {
    this.dummyHash = await hash('dummy-password-for-timing');
  }

  async register(dto: RegisterDto): Promise<SelfUser> {
    const invitation = await this.resolveInvitation(dto);
    const passwordHash = await hash(dto.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Claimed atomically: two submissions of one link cannot both win.
        const { count } = await tx.invitation.updateMany({
          where: {
            id: invitation.id,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });
        if (!count) {
          throw new BadRequestException({ code: 'invalid_invitation' });
        }
        const user = await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            termsAcceptedAt: new Date(),
          },
          select: selfUserSelect,
        });
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { usedById: user.id },
        });
        return user;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({ code: 'email_taken' });
      }
      throw error;
    }
  }

  /*
   * Every failure answers the same invalid_invitation: an unknown token, a
   * wrong code, a code for another address, an expired or used invitation.
   * A wrong code counts against every pending code of that address, which
   * locks after MAX_FAILED_ATTEMPTS.
   */
  private async resolveInvitation(dto: RegisterDto) {
    const invalid = () =>
      new BadRequestException({ code: 'invalid_invitation' });
    // Exactly one path: a link never comes with an email, the account takes
    // the invitation's.
    const byToken = Boolean(dto.token) && !dto.email && !dto.code;
    const byCode = !dto.token && Boolean(dto.email && dto.code);
    if (!byToken && !byCode) throw invalid();

    const secret = byToken ? dto.token! : normalizeCode(dto.code!);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashSecret(secret) },
    });
    const matches =
      invitation &&
      invitation.kind === (byToken ? 'LINK' : 'CODE') &&
      (byToken || invitation.email === dto.email) &&
      invitationStatus(invitation) === 'PENDING';

    if (!matches) {
      if (byCode) {
        await this.prisma.invitation.updateMany({
          where: {
            email: dto.email,
            kind: 'CODE',
            usedAt: null,
            revokedAt: null,
          },
          data: { failedAttempts: { increment: 1 } },
        });
      }
      throw invalid();
    }
    return invitation;
  }

  async login(dto: LoginDto): Promise<SelfUser> {
    const credentials = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, passwordHash: true },
    });
    const valid = await verify(
      credentials?.passwordHash ?? this.dummyHash,
      dto.password,
    );
    if (!credentials || !valid) {
      throw new UnauthorizedException({ code: 'invalid_credentials' });
    }
    return this.prisma.user.findUniqueOrThrow({
      where: { id: credentials.id },
      select: selfUserSelect,
    });
  }

  hashPassword(password: string): Promise<string> {
    return hash(password);
  }

  // Re-entry of the acting user's own password before a sensitive action.
  async confirmPassword(userId: string, password: string): Promise<void> {
    const { passwordHash } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await verify(passwordHash, password))) {
      throw new ForbiddenException({ code: 'password_confirmation_failed' });
    }
  }

  // Also the way out of a temporary password set by an admin.
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const { passwordHash, termsAcceptedAt } =
      await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { passwordHash: true, termsAcceptedAt: true },
      });
    if (!(await verify(passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException({ code: 'invalid_credentials' });
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException({ code: 'password_unchanged' });
    }
    if (!termsAcceptedAt && dto.acceptTerms !== true) {
      throw new BadRequestException({ code: 'terms_required' });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hash(dto.newPassword),
        mustChangePassword: false,
        ...(!termsAcceptedAt && { termsAcceptedAt: new Date() }),
      },
    });
  }

  /*
   * "Mot de passe oublié" (docs/auth.md, Password reset). Answers the same way
   * whether the address has an account or not, and does not wait for the
   * mail, the slow part. A new link replaces the previous ones.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, firstName: true },
    });
    if (!user) return;
    const token = generateLinkToken();
    await this.prisma.$transaction([
      this.prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: hashSecret(token),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      }),
    ]);
    void this.mail
      .send({
        to: email,
        subject: 'Shobukan Dojo : réinitialisation de votre mot de passe',
        text: [
          `Bonjour ${user.firstName},`,
          '',
          'Vous avez demandé à réinitialiser le mot de passe de votre espace pratiquant. Pour en choisir un nouveau, ouvrez ce lien (valable une heure, utilisable une seule fois) :',
          `${this.webUrl}/mot-de-passe-oublie/nouveau?token=${token}`,
          '',
          "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.",
          '',
          'Le bureau du Shobukan Dojo',
        ].join('\n'),
      })
      .catch(() => this.logger.warn('password reset mail not delivered'));
  }

  /*
   * Claimed atomically like an invitation. Every other session is closed, a
   * temporary password set by an admin is cleared, and an account that never
   * accepted the terms accepts them here.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const invalid = () =>
      new BadRequestException({ code: 'invalid_reset_token' });
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: hashSecret(dto.token) },
      select: {
        id: true,
        usedAt: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            termsAcceptedAt: true,
          },
        },
      },
    });
    if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) {
      throw invalid();
    }
    const { user } = reset;
    if (!user.termsAcceptedAt && dto.acceptTerms !== true) {
      throw new BadRequestException({ code: 'terms_required' });
    }
    const passwordHash = await hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.passwordReset.updateMany({
        where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (!count) throw invalid();
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          ...(!user.termsAcceptedAt && { termsAcceptedAt: new Date() }),
        },
      });
      await tx.passwordReset.deleteMany({
        where: { userId: user.id, id: { not: reset.id } },
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
    });
    await this.mail
      .send({
        to: user.email,
        subject: 'Shobukan Dojo : votre mot de passe a été modifié',
        text: [
          `Bonjour ${user.firstName},`,
          '',
          'Le mot de passe de votre espace pratiquant vient d’être modifié et vos appareils ont été déconnectés.',
          `Vous pouvez vous reconnecter sur ${this.webUrl}/connexion.`,
          "Si vous n'êtes pas à l'origine de ce changement, prévenez le bureau au plus vite.",
          '',
          'Le bureau du Shobukan Dojo',
        ].join('\n'),
      })
      .catch(() => undefined);
  }

  /*
   * A temporary password chosen by an admin (docs/members.md, Temporary
   * password). The member is signed out everywhere and must replace it at the
   * next login; pending reset links stop working.
   */
  async setTemporaryPassword(
    userId: string,
    temporaryPassword: string,
  ): Promise<void> {
    const passwordHash = await hash(temporaryPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: true },
      }),
      this.prisma.passwordReset.deleteMany({ where: { userId } }),
      this.prisma.session.deleteMany({ where: { userId } }),
    ]);
  }
}
