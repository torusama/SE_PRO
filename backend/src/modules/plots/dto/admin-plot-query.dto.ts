import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { AdminListQueryDto } from '../../../common/dto/admin-list-query.dto';

export class AdminPlotQueryDto extends AdminListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  zoneId?: number;

  @IsOptional()
  @IsIn(['available', 'pending', 'reserved', 'sold', 'locked'])
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeDeleted = false;
}
