import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
// Multipart fields arrive as strings: an empty one means "no date".
const dateOrNull = ({ value }: { value: unknown }) =>
  value === '' || value === 'null' ? null : value;

export const MEMBER_CATEGORIES = ['MEDICAL_CERTIFICATE', 'OTHER'] as const;
export const DOJO_CATEGORIES = ['LEGAL', 'ACCOUNTING', 'OTHER'] as const;

class DocumentFieldsDto {
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  title!: string;
}

export class CreateMemberDocumentDto extends DocumentFieldsDto {
  @IsIn(MEMBER_CATEGORIES)
  category!: (typeof MEMBER_CATEGORIES)[number];

  // A medical certificate without an end date cannot be checked by the dojo.
  @ValidateIf(
    (dto: CreateMemberDocumentDto) =>
      dto.category === 'MEDICAL_CERTIFICATE' || dto.validUntil != null,
  )
  @Transform(dateOrNull)
  @IsDateString({ strict: true })
  validUntil?: string | null;
}

export class CreateDojoDocumentDto extends DocumentFieldsDto {
  @IsIn(DOJO_CATEGORIES)
  category!: (typeof DOJO_CATEGORIES)[number];

  @IsOptional()
  @Transform(dateOrNull)
  @IsDateString({ strict: true })
  validUntil?: string | null;
}

export class UpdateDocumentDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  title?: string;

  @IsOptional()
  @Transform(dateOrNull)
  @IsDateString({ strict: true })
  validUntil?: string | null;
}

export class UpsertLicenseDto {
  @IsUUID()
  userId!: string;

  // FFK seasons run September to August: "2026-2027".
  @Matches(/^\d{4}-\d{4}$/)
  season!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 40)
  number!: string;
}

export class ListLicensesQuery {
  @IsOptional()
  @IsUUID()
  userId?: string;
}
