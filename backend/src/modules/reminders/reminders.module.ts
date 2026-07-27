import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminRemindersController, RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [NotificationsModule, EmailModule],
  controllers: [RemindersController, AdminRemindersController], // ← thêm AdminRemindersController
  providers: [RemindersService],
})
export class RemindersModule {}