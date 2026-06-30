import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

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
