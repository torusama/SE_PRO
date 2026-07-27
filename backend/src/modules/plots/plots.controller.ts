import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePlotDto } from './dto/create-plot.dto';
import {
  LockPlotDto,
  UpdatePlotDto,
  UpdatePlotPriceDto,
  UpdatePlotStatusDto,
} from './dto/update-plot.dto';
import { PlotsService } from './plots.service';
import { AdminPlotQueryDto } from './dto/admin-plot-query.dto';
import {
  CreateAdminZoneDto,
  UpdateAdminZoneDto,
} from './dto/admin-zone.dto';
import {
  CurrentAdminContext,
  type AdminRequestContext,
} from '../../common/decorators/admin-request-context.decorator';

interface AuthenticatedUser {
  id: number;
}

@Controller()
export class PlotsController {
  constructor(private readonly plotsService: PlotsService) {}

  @Get('plots')
  async findAll(@Query('status') status?: string) {
    return { success: true, data: await this.plotsService.findAll(status) };
  }

  @Get('plots/map')
  async map() {
    return { success: true, data: await this.plotsService.map() };
  }

  @Get('admin/plot-zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async zones() {
    return { success: true, data: await this.plotsService.adminZones() };
  }

  @Post('admin/plot-zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async createZone(@Body() dto: CreateAdminZoneDto) {
    return { success: true, data: await this.plotsService.createZone(dto) };
  }

  @Patch('admin/plot-zones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateZone(
    @Param('id') id: string,
    @Body() dto: UpdateAdminZoneDto,
  ) {
    return {
      success: true,
      data: await this.plotsService.updateZone(Number(id), dto),
    };
  }

  @Delete('admin/plot-zones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async deactivateZone(@Param('id') id: string) {
    return {
      success: true,
      data: await this.plotsService.deactivateZone(Number(id)),
    };
  }

  @Post('admin/plot-zones/:id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async restoreZone(@Param('id') id: string) {
    return {
      success: true,
      data: await this.plotsService.restoreZone(Number(id)),
    };
  }

  @Get('admin/plots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminFindAll(@Query() query: AdminPlotQueryDto) {
    return { success: true, data: await this.plotsService.adminFindAll(query) };
  }

  @Get('admin/plots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminFindOne(@Param('id') id: string) {
    return {
      success: true,
      data: await this.plotsService.findOne(Number(id)),
    };
  }

  @Get('plots/:id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.plotsService.findOne(Number(id)) };
  }

  @Post('admin/plots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(
    @Body() dto: CreatePlotDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Plot created',
      data: await this.plotsService.adminCreate(dto, context),
    };
  }

  @Patch('admin/plots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePlotDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Plot updated',
      data: await this.plotsService.adminUpdate(Number(id), dto, context),
    };
  }

  @Patch('admin/plots/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePlotStatusDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Plot status updated',
      data: await this.plotsService.adminStatus(Number(id), dto.status, context),
    };
  }

  @Patch('admin/plots/:id/price')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updatePrice(
    @Param('id') id: string,
    @Body() dto: UpdatePlotPriceDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Plot price updated',
      data: await this.plotsService.adminPrice(Number(id), dto.price, context),
    };
  }

  @Post('admin/plots/:id/lock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async lock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: LockPlotDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Plot locked',
      data: await this.plotsService.adminLock(
        Number(id),
        user.id,
        dto.reason,
        context,
      ),
    };
  }

  @Post('admin/plots/:id/unlock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async unlock(
    @Param('id') id: string,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Plot unlocked',
      data: await this.plotsService.adminUnlock(Number(id), context),
    };
  }

  @Delete('admin/plots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async remove(
    @Param('id') id: string,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Plot deleted',
      data: await this.plotsService.adminRemove(Number(id), context),
    };
  }

  @Post('admin/plots/:id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async restore(
    @Param('id') id: string,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Đã khôi phục lô',
      data: await this.plotsService.adminRestore(Number(id), context),
    };
  }
}
