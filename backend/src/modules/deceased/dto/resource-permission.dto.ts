import { Type } from 'class-transformer';
import { IsIn, IsInt, Min } from 'class-validator';
export class GrantResourcePermissionDto {
  @Type(() => Number) @IsInt() @Min(1) memberUserId: number;
  @IsIn(['deceased_profile', 'plot', 'service_order']) resourceType:
    'deceased_profile' | 'plot' | 'service_order';
  @Type(() => Number) @IsInt() @Min(1) resourceId: number;
  @IsIn(['view_profile', 'view_plot', 'view_service_history', 'order_service'])
  action:
    'view_profile' | 'view_plot' | 'view_service_history' | 'order_service';
}
