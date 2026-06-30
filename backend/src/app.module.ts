import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envConfig } from './config/env.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PlotsModule } from './modules/plots/plots.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { CemeteryServicesModule } from './modules/cemetery-services/cemetery-services.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [envConfig] }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    PlotsModule,
    ReservationsModule,
    ContractsModule,
    CemeteryServicesModule,
    NotificationsModule,
    DashboardModule,
    AiAgentModule,
    UploadsModule,
  ],
})
export class AppModule {}
