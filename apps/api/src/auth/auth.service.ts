import {
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
    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash: await hash(dto.password),
          firstName: dto.firstName,
          lastName: dto.lastName,
          termsAcceptedAt: new Date(),
        },
        select: selfUserSelect,
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
