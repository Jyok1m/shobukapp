import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DISCIPLINES } from '../../documents/dto/documents.dto';

export type Discipline = (typeof DISCIPLINES)[number];
export const REQUEST_STATUSES = ['PENDING', 'SENT', 'DONE'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
// DONE is only reached by uploading the licence.
const SETTABLE_STATUSES = ['PENDING', 'SENT'] as const;

// FFJDA seasons run September to August: "2026-2027".
const SEASON = /^\d{4}-\d{4}$/;

const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class ExportLicenseRequestsQuery {
  @IsOptional()
  @Matches(SEASON)
  season?: string;

  @IsOptional()
  @IsIn(REQUEST_STATUSES)
  status?: RequestStatus;
}

export class ListLicenseRequestsQuery extends ExportLicenseRequestsQuery {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateLicenseRequestsDto {
  @IsUUID()
  userId!: string;

  @Matches(SEASON)
  season!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(DISCIPLINES.length)
  @ArrayUnique()
  @IsIn(DISCIPLINES, { each: true })
  disciplines!: Discipline[];

  @IsOptional()
  @Transform(trimOrUndefined)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateLicenseRequestDto {
  @IsOptional()
  @IsIn(SETTABLE_STATUSES)
  status?: (typeof SETTABLE_STATUSES)[number];

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
