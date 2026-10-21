import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
