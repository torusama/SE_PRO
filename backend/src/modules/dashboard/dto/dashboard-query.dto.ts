import { IsIn, IsOptional } from 'class-validator';
import type { RevenuePeriod } from '../dashboard.service';

export class DashboardRevenueQueryDto {
  @IsOptional()
  @IsIn(['day', 'month', 'quarter', 'year'])
  period: RevenuePeriod = 'month';
}
