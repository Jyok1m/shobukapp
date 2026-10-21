import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { PlanInterval } from '../../generated/prisma/enums';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class PlanPriceDto {
  @IsEnum(PlanInterval)
  frequency!: PlanInterval;

  // Stripe refuses amounts below 0.50 EUR; 1 EUR keeps a margin.
  @IsInt()
  @Min(100)
  @Max(1_000_000)
  amountCents!: number;

  @IsBoolean()
  active!: boolean;
}

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

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  // Billed with the first payment, then at each yearly anniversary.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  entranceFeeCents?: number;

  // Up to one row per frequency; the service checks at least one is offered.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => PlanPriceDto)
  prices!: PlanPriceDto[];
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
  @Min(0)
  sortOrder?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(100_000)
  entranceFeeCents?: number;

  // Frequencies listed here are created or updated; the others are untouched.
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => PlanPriceDto)
  prices?: PlanPriceDto[];
}

export class CheckoutDto {
  @IsUUID()
  planId!: string;

  @IsEnum(PlanInterval)
  frequency!: PlanInterval;
}

export class StripeModeDto {
  @IsIn(['test', 'live'])
  mode!: 'test' | 'live';

  // The acting admin's own password: going live takes real money.
  @IsString()
  @MaxLength(128)
  password!: string;
}

export class FrequencyDto {
  @IsEnum(PlanInterval)
  frequency!: PlanInterval;
}
