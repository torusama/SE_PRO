import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { CemeteryServicesController } from './cemetery-services.controller';
import { CemeteryServicesService } from './cemetery-services.service';

@Module({
  imports: [EmailModule],
  controllers: [CemeteryServicesController],
  providers: [CemeteryServicesService],
  exports: [CemeteryServicesService],
})
export class CemeteryServicesModule {}