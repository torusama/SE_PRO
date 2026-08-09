import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SessionsModule } from '../sessions/sessions.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeMutationInterceptor } from './realtime-mutation.interceptor';
import { RealtimeService } from './realtime.service';

@Global()
@Module({
  imports: [
    SessionsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwtSecret') ?? 'change_this_secret',
      }),
    }),
  ],
  providers: [
    RealtimeGateway,
    RealtimeService,
    RealtimeMutationInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: RealtimeMutationInterceptor,
    },
  ],
  exports: [RealtimeService],
})
export class RealtimeModule {}
