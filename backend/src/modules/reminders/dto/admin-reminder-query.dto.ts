import { IsIn, IsOptional } from 'class-validator';
import { AdminListQueryDto } from '../../../common/dto/admin-list-query.dto';

export class AdminReminderQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(['all', 'memorial', 'anniversary', 'maintenance', 'payment'])
  type?: string;
}
