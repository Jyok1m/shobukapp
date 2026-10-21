import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export const MEMBERSHIP_FILTERS = ['active', 'past_due', 'none'] as const;
export type MembershipFilter = (typeof MEMBERSHIP_FILTERS)[number];

export class ListMembersQuery {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(MEMBERSHIP_FILTERS)
  status?: MembershipFilter;
}

export class ReminderDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(1000)
  note?: string;
}

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateMemberDto {
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 80)
  lastName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  temporaryPassword!: string;
}

export class ChangeRoleDto {
  @IsIn(['PRACTITIONER', 'ADMIN'])
  role!: 'PRACTITIONER' | 'ADMIN';

  // The acting admin's own password, re-entered.
  @IsString()
  @MaxLength(128)
  password!: string;
}
