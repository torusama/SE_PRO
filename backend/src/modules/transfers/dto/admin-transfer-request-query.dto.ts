import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminListQueryDto } from '../../../common/dto/admin-list-query.dto';

export class AdminTransferRequestQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn([
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'appointment_scheduled',
    'pdf_generated',
    'payment_recorded',
    'evidence_uploaded',
    'completed',
  ])
  status?: string;

  @IsOptional()
  @IsIn(['sale', 'inheritance', 'gift'])
  transferType?: string;
}
