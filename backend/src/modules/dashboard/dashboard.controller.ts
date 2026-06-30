import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async summary() { return { success: true, data: await this.dashboardService.summary() }; }

  @Get('plots')
  async plots() { return { success: true, data: await this.dashboardService.plots() }; }

  @Get('revenue')
  async revenue() { return { success: true, data: await this.dashboardService.revenue() }; }

  @Get('services')
  async services() { return { success: true, data: await this.dashboardService.services() }; }
}
