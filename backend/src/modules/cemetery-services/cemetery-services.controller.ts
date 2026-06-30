import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CemeteryServicesService } from './cemetery-services.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';

@Controller()
export class CemeteryServicesController {
  constructor(private readonly service: CemeteryServicesService) {}

  @Get('service-types')
  async serviceTypes() { return { success: true, data: await this.service.serviceTypes() }; }

  @Post('service-orders')
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: any, @Body() dto: CreateServiceOrderDto) {
    return { success: true, message: 'Service order created', data: await this.service.createOrder(user.id, dto) };
  }

  @Get('my/service-orders')
  @UseGuards(JwtAuthGuard)
  async my(@CurrentUser() user: any) { return { success: true, data: await this.service.myOrders(user.id) }; }

  @Get('my/service-orders/:id')
  @UseGuards(JwtAuthGuard)
  async myOne(@CurrentUser() user: any, @Param('id') id: string) { return { success: true, data: await this.service.one(Number(id), user.id) }; }

  @Get('admin/service-orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminOrders() { return { success: true, data: await this.service.adminOrders() }; }

  @Get('admin/service-orders/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminOne(@Param('id') id: string) { return { success: true, data: await this.service.one(Number(id)) }; }

  @Patch('admin/service-orders/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async status(@CurrentUser() user: any, @Param('id') id: string, @Body('status') status: string) {
    return { success: true, message: 'Service order status updated', data: await this.service.updateStatus(Number(id), status, user.id) };
  }

  @Post('admin/service-orders/:id/completion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async complete(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return { success: true, message: 'Service order completed', data: await this.service.complete(Number(id), body, user.id) };
  }
}
