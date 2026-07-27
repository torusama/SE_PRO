import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AdminListQueryDto } from '../../../common/dto/admin-list-query.dto';

export class AdminNotificationQueryDto extends AdminListQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  broadcast?: boolean;
}

export class BroadcastNotificationDto {
  @IsIn(['all_customers'])
  audience!: 'all_customers';

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsIn(['announcement', 'payment_reminder', 'maintenance', 'urgent'])
  type = 'announcement';

  @IsOptional()
  @IsIn(['in_app'])
  channel = 'in_app';
}
