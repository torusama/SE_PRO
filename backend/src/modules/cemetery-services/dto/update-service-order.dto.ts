import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const SERVICE_ORDER_STATUSES = [
  'submitted',
  'pending_confirm',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];

export class UpdateServiceOrderDto {
  @IsOptional()
  @IsIn(SERVICE_ORDER_STATUSES)
  status?: ServiceOrderStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  assignedTo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;
}

export class CompleteServiceOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  completionNote?: string;
}
