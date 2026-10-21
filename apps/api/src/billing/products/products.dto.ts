import { Transform } from 'class-transformer';
import {
  IsBoolean,
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

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class UpdateProductDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(300)
  description?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(100)
  @Max(1_000_000)
  amountCents?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  memberPurchasable?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}

export class RequestChargeDto {
  @IsUUID()
  productId!: string;

  // Send a Stripe payment link by mail now; otherwise only record the request.
  @IsBoolean()
  sendLink!: boolean;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(300)
  note?: string | null;
}

export class SetChargeStatusDto {
  // PAID here means paid by hand (cash, cheque): MANUAL.
  @IsIn(['PENDING', 'PAID', 'DECLINED', 'WAIVED'])
  status!: 'PENDING' | 'PAID' | 'DECLINED' | 'WAIVED';
}
