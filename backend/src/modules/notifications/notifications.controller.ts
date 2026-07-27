import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminNotificationQueryDto, BroadcastNotificationDto } from './dto/admin-notification.dto';
import { CurrentAdminContext, type AdminRequestContext } from '../../common/decorators/admin-request-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: any) { return { success: true, data: await this.notificationsService.list(user.id) }; }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: any) { return { success: true, data: await this.notificationsService.unreadCount(user.id) }; }

  @Patch(':id/read')
  async read(@CurrentUser() user: any, @Param('id') id: string) {
    return { success: true, data: await this.notificationsService.markRead(user.id, Number(id)) };
  }

  @Patch('read-all')
  async readAll(@CurrentUser() user: any) { return { success: true, data: await this.notificationsService.readAll(user.id) }; }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Query() query: AdminNotificationQueryDto) {
    return { success: true, data: await this.notificationsService.adminList(query) };
  }

  @Post('broadcast')
  async broadcast(
    @Body() dto: BroadcastNotificationDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Đã gửi thông báo trong ứng dụng',
      data: await this.notificationsService.broadcast(dto, context),
    };
  }
}
