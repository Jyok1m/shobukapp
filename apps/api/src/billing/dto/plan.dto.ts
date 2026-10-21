import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PlanInterval } from '../../generated/prisma/enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class CreatePlanDto {
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  // Stripe refuses amounts below 0.50 EUR; 1 EUR keeps a margin.
  @IsInt()
  @Min(100)
  @Max(1_000_000)
  amountCents!: number;

  @IsEnum(PlanInterval)
  interval!: PlanInterval;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdatePlanDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(100)
  @Max(1_000_000)
  amountCents?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(PlanInterval)
  interval?: PlanInterval;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}

export class CheckoutDto {
  @IsUUID()
  planId!: string;
}

export class StripeModeDto {
  @IsIn(['test', 'live'])
  mode!: 'test' | 'live';

  // The acting admin's own password: going live takes real money.
  @IsString()
  @MaxLength(128)
  password!: string;
}
