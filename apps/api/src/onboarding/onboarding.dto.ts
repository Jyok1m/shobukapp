import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

class PersonDto {
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 80)
  lastName!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class CreateJoinRequestDto extends PersonDto {
  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @Transform(trim)
  @IsString()
  @Length(10, 2000)
  message!: string;

  @IsBoolean()
  wantsTrial!: boolean;

  @Equals(true)
  acceptPrivacy!: boolean;

  // Honeypot: hidden from humans, filled by naive bots.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class CreateCodeInvitationDto extends PersonDto {}

export class UpdateJoinRequestDto {
  @IsIn(['NEW', 'DECLINED'])
  status!: 'NEW' | 'DECLINED';
}

export class ListJoinRequestsQuery {
  @IsOptional()
  @IsIn(['NEW', 'INVITED', 'DECLINED'])
  status?: 'NEW' | 'INVITED' | 'DECLINED';

  @IsOptional()
  @IsUUID()
  cursor?: string;
}
