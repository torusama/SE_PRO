import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
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
  @IsIn(['all_customers', 'single_customer'])
  audience!: 'all_customers' | 'single_customer';

  // Bắt buộc khi audience = 'single_customer': email của khách hàng cần
  // gửi riêng. Được kiểm tra tồn tại trong bảng users trước khi tạo thông
  // báo — nếu không có, service sẽ trả lỗi để admin biết và nhập lại.
  @ValidateIf((dto) => dto.audience === 'single_customer')
  @IsEmail()
  @MaxLength(255)
  recipientEmail?: string;

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
