import { IsIn, IsOptional } from 'class-validator';
import { AdminListQueryDto } from '../../../common/dto/admin-list-query.dto';

export class AdminAiActivityQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(['draft', 'pending', 'submitted', 'approved', 'rejected', 'cancelled'])
  status?: string;
}
