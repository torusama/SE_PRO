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
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { RemindersService } from './reminders.service';
import { AdminReminderQueryDto } from './dto/admin-reminder-query.dto';

// ── Customer routes (/my/reminders) ─────────────────────────────────────────
@UseGuards(JwtAuthGuard)
@Controller('my/reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  async my(@CurrentUser() user: any) {
    return { success: true, data: await this.remindersService.my(user.id) };
  }

  @Get('upcoming')
  async upcoming(@CurrentUser() user: any) {
    return {
      success: true,
      data: await this.remindersService.upcoming(user.id),
    };
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateReminderDto) {
    return {
      success: true,
      message: 'Đã tạo nhắc lịch',
      data: await this.remindersService.create(user.id, dto),
    };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return {
      success: true,
      message: 'Đã cập nhật nhắc lịch',
      data: await this.remindersService.update(user.id, Number(id), dto),
    };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return {
      success: true,
      message: 'Đã xoá nhắc lịch',
      data: await this.remindersService.remove(user.id, Number(id)),
    };
  }
}

// ── Admin routes (/admin/reminders) ─────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/reminders')
export class AdminRemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  /** GET /admin/reminders?type=&search=  — lấy toàn bộ nhắc lịch mọi user */
  @Get()
  async all(@Query() query: AdminReminderQueryDto) {
    return {
      success: true,
      data: await this.remindersService.allForAdmin(query),
    };
  }

  /** POST /admin/reminders/:id/notify-now — gửi nhắc thủ công ngay */
  @Post(':id/notify-now')
  async notifyNow(@Param('id') id: string) {
    return {
      success: true,
      message: 'Đã gửi nhắc nhở tới khách hàng',
      data: await this.remindersService.notifyNow(Number(id)),
    };
  }
}
