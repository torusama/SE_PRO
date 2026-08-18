import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { AdminListQueryDto } from '../../../common/dto/admin-list-query.dto';

export class AdminOwnershipQueryDto extends AdminListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  plotId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  holderId?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  currentOnly?: boolean;
}
