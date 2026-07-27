import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { CreateAvailabilitySlotDto } from './dto/create-availability-slot.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { UpdateAvailabilitySlotDto } from './dto/update-availability-slot.dto';
import { ScheduleService } from './schedule.service';

interface AuthenticatedUser {
  id: number;
  role: string;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  // -- Availability slots (any authenticated user manages their own) -----

  @Post('schedule/slots')
  async createSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAvailabilitySlotDto,
  ) {
    return {
      success: true,
      message: 'Availability slot created',
      data: await this.scheduleService.createSlot(user.id, dto),
    };
  }

  @Get('schedule/slots/me')
  async myslots(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      data: await this.scheduleService.listMySlots(user.id),
    };
  }

  @Get('schedule/slots/users/:userId')
  async userSlots(@Param('userId') userId: string) {
    return {
      success: true,
      data: await this.scheduleService.listUserSlots(Number(userId)),
    };
  }

  @Get('schedule/hosts')
  async availableHosts(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.scheduleService.listAvailableHosts(user.id) };
  }

  @Patch('schedule/slots/:id')
  async updateSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilitySlotDto,
  ) {
    return {
      success: true,
      message: 'Availability slot updated',
      data: await this.scheduleService.updateSlot(user.id, Number(id), dto),
    };
  }

  @Delete('schedule/slots/:id')
  async deleteSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return {
      success: true,
      message: 'Availability slot deleted',
      data: await this.scheduleService.deleteSlot(user.id, Number(id)),
    };
  }

  // -- Appointments --------------------------------------------------------

  @Post('schedule/appointments')
  async bookAppointment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BookAppointmentDto,
  ) {
    return {
      success: true,
      message: 'Appointment requested',
      data: await this.scheduleService.bookAppointment(user.id, dto),
    };
  }

  @Get('schedule/appointments/me')
  async myAppointments(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      data: await this.scheduleService.listMyAppointments(user.id),
    };
  }

  @Get('schedule/admin/appointments')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async allAppointments(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: await this.scheduleService.listAllAppointments(user.role) };
  }

  @Patch('schedule/appointments/:id/status')
  async updateAppointmentStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return {
      success: true,
      message: 'Appointment updated',
      data: await this.scheduleService.updateAppointmentStatus(
        user.id,
        user.role,
        Number(id),
        dto,
      ),
    };
  }
}
