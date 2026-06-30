import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ContractsService } from './contracts.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('admin/contracts')
  @Roles('admin')
  async adminList() { return { success: true, data: await this.contractsService.adminList() }; }

  @Get('admin/contracts/:id')
  @Roles('admin')
  async adminOne(@Param('id') id: string) { return { success: true, data: await this.contractsService.adminOne(Number(id)) }; }

  @Post('admin/contracts/from-reservation/:reservationId')
  @Roles('admin')
  async fromReservation(@CurrentUser() user: any, @Param('reservationId') reservationId: string) {
    return { success: true, message: 'Contracts created', data: await this.contractsService.createFromReservation(Number(reservationId), user.id) };
  }

  @Patch('admin/contracts/:id/status')
  @Roles('admin')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return { success: true, message: 'Contract status updated', data: await this.contractsService.updateStatus(Number(id), status) };
  }

  @Post('admin/contracts/:id/payments')
  @Roles('admin')
  async addPayment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return { success: true, message: 'Payment added', data: await this.contractsService.addPayment(Number(id), body, user.id) };
  }

  @Get('my/contracts')
  async my(@CurrentUser() user: any) { return { success: true, data: await this.contractsService.my(user.id) }; }

  @Get('my/contracts/:id')
  async myOne(@CurrentUser() user: any, @Param('id') id: string) {
    return { success: true, data: await this.contractsService.myOne(user.id, Number(id)) };
  }
}
