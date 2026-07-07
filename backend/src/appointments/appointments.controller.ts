import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AppointmentsService } from './appointments.service';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post('availability')
  async addAvailability(
    @CurrentUser() user: any,
    @Body() body: { date: string; startTime: string; endTime: string }
  ) {
    return {
      success: true,
      data: await this.appointmentsService.createAvailability(user.id, body.date, body.startTime, body.endTime),
    };
  }

  @Get('availability')
  async getAvailability(@Query('date') date: string) {
    return {
      success: true,
      data: await this.appointmentsService.getAvailableSlots(date),
    };
  }

  @Post('book')
  async book(
    @CurrentUser() user: any,
    @Body() body: { slotId: number; purpose: string }
  ) {
    return {
      success: true,
      data: await this.appointmentsService.bookAppointment(user.id, body.slotId, body.purpose),
    };
  }
}