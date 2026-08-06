import {
  Body,
  Controller,
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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AdminAppointmentQueryDto } from './dto/admin-appointment-query.dto';
import { RespondAppointmentDto } from './dto/respond-appointment.dto';
import {
  CurrentAdminContext,
  type AdminRequestContext,
} from '../../common/decorators/admin-request-context.decorator';

interface AuthenticatedUser {
  id: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post('admin/appointments')
  @Roles('admin')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppointmentDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Appointment created',
      data: await this.appointmentsService.create(user.id, dto, context),
    };
  }

  @Get('my/appointments')
  @Roles('customer')
  async my(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    return {
      success: true,
      message: 'Appointments retrieved',
      data: await this.appointmentsService.my(user.id, status),
    };
  }

  @Patch('my/appointments/:id/response')
  @Roles('customer')
  async respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RespondAppointmentDto,
  ) {
    return {
      success: true,
      message: 'Appointment response recorded',
      data: await this.appointmentsService.respond(user.id, Number(id), dto),
    };
  }

  @Get('admin/appointments')
  @Roles('admin')
  async adminList(@Query() query: AdminAppointmentQueryDto) {
    return {
      success: true,
      message: 'Appointments retrieved',
      data: await this.appointmentsService.adminList(query),
    };
  }

  @Patch('admin/appointments/:id')
  @Roles('admin')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Appointment updated',
      data: await this.appointmentsService.update(
        user.id,
        Number(id),
        dto,
        context,
      ),
    };
  }

  @Patch('admin/appointments/:id/status')
  @Roles('admin')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Appointment status updated',
      data: await this.appointmentsService.updateStatus(
        user.id,
        Number(id),
        dto,
        context,
      ),
    };
  }
}
