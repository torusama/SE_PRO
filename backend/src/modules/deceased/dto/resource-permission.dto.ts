import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
export class GrantResourcePermissionDto {
  @Type(() => Number) @IsInt() @Min(1) memberUserId: number;
  // Chỉ còn hỗ trợ chia sẻ hồ sơ tưởng niệm — trường này được giữ lại (tùy
  // chọn) để tương thích ngược, backend luôn tự gán 'deceased_profile' bất
  // kể giá trị gửi lên.
  @IsOptional() @IsIn(['deceased_profile']) resourceType?: 'deceased_profile';
  @Type(() => Number) @IsInt() @Min(1) resourceId: number;
  @IsIn(['view_profile']) action: 'view_profile';
}
