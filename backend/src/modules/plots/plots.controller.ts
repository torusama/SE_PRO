import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePlotDto } from './dto/create-plot.dto';
import { UpdatePlotDto, UpdatePlotStatusDto } from './dto/update-plot.dto';
import { PlotsService } from './plots.service';

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

  @Get('plots/:id')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.plotsService.findOne(Number(id)) };
  }

  @Post('admin/plots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreatePlotDto) {
    return { success: true, message: 'Plot created', data: await this.plotsService.create(dto) };
  }

  @Patch('admin/plots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdatePlotDto) {
    return { success: true, message: 'Plot updated', data: await this.plotsService.update(Number(id), dto) };
  }

  @Patch('admin/plots/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdatePlotStatusDto) {
    return { success: true, message: 'Plot status updated', data: await this.plotsService.updateStatus(Number(id), dto.status) };
  }

  @Delete('admin/plots/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string) {
    return { success: true, message: 'Plot deleted', data: await this.plotsService.remove(Number(id)) };
  }
}
