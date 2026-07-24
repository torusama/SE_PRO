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
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { RemindersService } from './reminders.service';

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
