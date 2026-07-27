import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { AdminListQueryDto } from '../../../common/dto/admin-list-query.dto';

export class AdminUserQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(['admin', 'customer'])
  role?: 'admin' | 'customer';

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;
}
