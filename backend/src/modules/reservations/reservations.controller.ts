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
import { CreateMultipleReservationDto } from './dto/create-multiple-reservation.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { ReservationsService } from './reservations.service';
import { AdminReservationQueryDto } from './dto/admin-reservation-query.dto';
import {
  CurrentAdminContext,
  type AdminRequestContext,
} from '../../common/decorators/admin-request-context.decorator';

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
      message: 'Đã tạo yêu cầu giữ chỗ hoặc mua lô',
      data: await this.reservationsService.create(user.id, dto),
    };
  }

  @Post('reservations/multiple')
  @Roles('customer')
  async createMultiple(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMultipleReservationDto,
  ) {
    return {
      success: true,
      message: 'Đã tạo yêu cầu cho nhiều lô',
      data: await this.reservationsService.createMultiple(user.id, dto),
    };
  }

  @Get('my/reservations')
  @Roles('customer')
  async my(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      message: 'Đã tải danh sách yêu cầu',
      data: await this.reservationsService.my(user.id),
    };
  }

  @Get('my/reservations/:id')
  @Roles('customer')
  async myOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return {
      success: true,
      message: 'Đã tải thông tin yêu cầu',
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
      message: 'Đã gửi yêu cầu',
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
      message: 'Đã hủy yêu cầu',
      data: await this.reservationsService.cancel(user.id, Number(id)),
    };
  }

  @Get('admin/reservations')
  @Roles('admin')
  async adminList(@Query() query: AdminReservationQueryDto) {
    return {
      success: true,
      message: 'Đã tải danh sách yêu cầu',
      data: await this.reservationsService.adminList(query),
    };
  }

  @Get('admin/reservations/:id')
  @Roles('admin')
  async adminOne(@Param('id') id: string) {
    return {
      success: true,
      message: 'Đã tải thông tin yêu cầu',
      data: await this.reservationsService.adminOne(Number(id)),
    };
  }

  @Patch('admin/reservations/:id/approve')
  @Roles('admin')
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Đã duyệt yêu cầu',
      data: await this.reservationsService.approve(
        user.id,
        Number(id),
        dto.adminNote,
        context,
      ),
    };
  }

  @Patch('admin/reservations/:id/reject')
  @Roles('admin')
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Đã từ chối yêu cầu',
      data: await this.reservationsService.reject(
        user.id,
        Number(id),
        dto.adminNote,
        context,
      ),
    };
  }
}
