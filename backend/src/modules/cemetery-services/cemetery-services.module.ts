import { Module } from '@nestjs/common';
import { CemeteryServicesController } from './cemetery-services.controller';
import { CemeteryServicesService } from './cemetery-services.service';

@Module({
  controllers: [CemeteryServicesController],
  providers: [CemeteryServicesService],
  exports: [CemeteryServicesService],
})
export class CemeteryServicesModule {}
