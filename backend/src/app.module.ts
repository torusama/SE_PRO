import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { envConfig } from './config/env.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PlotsModule } from './modules/plots/plots.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { CemeteryServicesModule } from './modules/cemetery-services/cemetery-services.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { UploadsModule } from './uploads/uploads.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuthorizedPersonsModule } from './modules/authorized-persons/authorized-persons.module';
import { AdminAuditModule } from './modules/admin-audit/admin-audit.module';
import { TransfersModule } from './modules/transfers/transfers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [envConfig] }),
    // Bật cron job của Nest (dùng cho reminders.service.ts - nhắc lịch ngày giỗ).
    // Đổi tên khi import vì project đã có 1 module nội bộ tên trùng là
    // "ScheduleModule" (lịch hẹn/lịch rảnh), không liên quan đến cron.
    NestScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    PlotsModule,
    ReservationsModule,
    ContractsModule,
    CemeteryServicesModule,
    NotificationsModule,
    RemindersModule,
    DashboardModule,
    AiAgentModule,
    UploadsModule,
    ScheduleModule,
    AppointmentsModule,
    AuthorizedPersonsModule,
    AdminAuditModule,
    TransfersModule,
  ],
})
export class AppModule {}
