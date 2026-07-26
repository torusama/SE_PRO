import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [NotificationsModule, EmailModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}