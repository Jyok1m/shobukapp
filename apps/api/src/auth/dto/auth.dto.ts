import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}

// Signup only through an invitation: a link token, or an email and a code
// (docs/onboarding.md). The service checks that exactly one is given.
export class RegisterDto {
  @IsOptional()
  @IsString()
  @Length(43, 43)
  token?: string;

  @IsOptional()
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @Length(8, 12)
  code?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 80)
  lastName!: string;

  @Equals(true)
  acceptTerms!: boolean;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  newPassword!: string;

  // Required when the account never accepted them (created by an admin).
  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean;
}
