import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { ReservationsService } from './reservations.service';

interface AuthenticatedUser {
  id: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post('reservations')
  @Roles('customer')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReservationDto,
  ) {
    return {
      success: true,
      message: 'Reservation request created',
      data: await this.reservationsService.create(user.id, dto),
    };
  }

  @Get('my/reservations')
  @Roles('customer')
  async my(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      message: 'Reservations retrieved',
      data: await this.reservationsService.my(user.id),
    };
  }

  @Get('my/reservations/:id')
  @Roles('customer')
  async myOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return {
      success: true,
      message: 'Reservation retrieved',
      data: await this.reservationsService.myOne(user.id, Number(id)),
    };
  }

  @Post('reservations/:id/submit')
  @Roles('customer')
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return {
      success: true,
      message: 'Reservation submitted',
      data: await this.reservationsService.submit(user.id, Number(id)),
    };
  }

  @Post('reservations/:id/cancel')
  @Roles('customer')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return {
      success: true,
      message: 'Reservation cancelled',
      data: await this.reservationsService.cancel(user.id, Number(id)),
    };
  }

  @Get('admin/reservations')
  @Roles('admin')
  async adminList() {
    return {
      success: true,
      message: 'Reservations retrieved',
      data: await this.reservationsService.adminList(),
    };
  }

  @Get('admin/reservations/:id')
  @Roles('admin')
  async adminOne(@Param('id') id: string) {
    return {
      success: true,
      message: 'Reservation retrieved',
      data: await this.reservationsService.adminOne(Number(id)),
    };
  }

  @Patch('admin/reservations/:id/approve')
  @Roles('admin')
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    return {
      success: true,
      message: 'Reservation approved',
      data: await this.reservationsService.approve(
        user.id,
        Number(id),
        dto.adminNote,
      ),
    };
  }

  @Patch('admin/reservations/:id/reject')
  @Roles('admin')
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    return {
      success: true,
      message: 'Reservation rejected',
      data: await this.reservationsService.reject(
        user.id,
        Number(id),
        dto.adminNote,
      ),
    };
  }
}
