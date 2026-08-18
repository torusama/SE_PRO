import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { AdminListQueryDto } from '../../../common/dto/admin-list-query.dto';

export class AdminServiceOrderQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assigneeId?: number;
}
