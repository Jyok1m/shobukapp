import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsDateString,
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

  // Evenings the visitor can come: required with wantsTrial (service check).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsDateString({ strict: true }, { each: true })
  trialDates?: string[];

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

export class CursorQuery {
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

export class ScheduleTrialDto {
  // ISO 8601 with offset, e.g. 2026-11-04T19:30:00+01:00.
  @IsDateString({ strict: true })
  scheduledAt!: string;
}
