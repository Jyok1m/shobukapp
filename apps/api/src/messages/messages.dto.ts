import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  recipientId!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 2000)
  body!: string;
}

export class ThreadQuery {
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
