import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AdminRemindersController,
  RemindersController,
} from './reminders.controller';
import { RemindersService } from './reminders.service';
import { DeceasedModule } from '../deceased/deceased.module';

@Module({
  imports: [NotificationsModule, EmailModule, DeceasedModule],
  controllers: [RemindersController, AdminRemindersController], // ← thêm AdminRemindersController
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
