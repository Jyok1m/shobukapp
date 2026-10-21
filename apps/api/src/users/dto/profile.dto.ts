import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Sex } from '../../generated/prisma/enums';

// Empty strings become null, so a member can clear an optional field.
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Shared by PATCH /me and PATCH /admin/members/:id: never email, password or role.
export class UpdateProfileDto {
  // Required columns: null is refused, only absence skips validation.
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  firstName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  lastName?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsDateString({ strict: true })
  birthDate?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsEnum(Sex)
  sex?: Sex | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(60)
  nationality?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(200)
  addressLine?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(60)
  country?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(30)
  emergencyContactPhone?: string | null;
}

export class UpdateMyProfileDto extends UpdateProfileDto {
  // Only the member toggles it: absent from the admin DTO on purpose.
  @IsOptional()
  @IsBoolean()
  directoryVisible?: boolean;
}
