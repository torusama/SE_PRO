import { IsIn, IsOptional } from 'class-validator';
import { AdminListQueryDto } from '../../../common/dto/admin-list-query.dto';

export class AdminContractQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(['active', 'completed', 'cancelled', 'expired', 'transferred'])
  status?: string;

  @IsOptional()
  @IsIn(['unpaid', 'partial', 'paid'])
  paymentStatus?: string;
}
