import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { selfUserSelect, SelfUser } from '../common/self-user';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import {
  hashSecret,
  invitationStatus,
  normalizeCode,
} from '../onboarding/invitation-codes';

// The only service allowed to select password_hash (docs/auth.md).
@Injectable()
export class AuthService implements OnModuleInit {
  // Verified against when the email is unknown, so both failures take as long.
  private dummyHash = '';

  constructor(private readonly prisma: PrismaService) {}

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

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const { passwordHash } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await verify(passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException({ code: 'invalid_credentials' });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hash(dto.newPassword) },
    });
  }
}
