import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferRequestDto {
  /** Danh sách plot_id customer muốn chuyển nhượng (phải đang sở hữu) */
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  plotIds!: number[];

  /** Loại giao dịch */
  @IsIn(['sale', 'inheritance', 'gift'])
  transferType!: 'sale' | 'inheritance' | 'gift';

  // ── Thông tin Bên B (bắt buộc) ─────────────────────────────────────────
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  recipientFullName!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  recipientIdCard!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  recipientPhone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  recipientAddress?: string;

  @IsOptional()
  @IsDateString()
  recipientDateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  recipientRelationship?: string;

  // ── Thông tin giao dịch (chỉ bắt buộc với sale) ─────────────────────────
  @IsOptional()
  @Type(() => Number)
  transactionAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  agreementNote?: string;
}
