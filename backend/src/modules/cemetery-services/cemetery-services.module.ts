import { Module } from '@nestjs/common';
import { CemeteryServicesController } from './cemetery-services.controller';
import { CemeteryServicesService } from './cemetery-services.service';
import { DeceasedModule } from '../deceased/deceased.module';

@Module({
  imports: [DeceasedModule],
  controllers: [CemeteryServicesController],
  providers: [CemeteryServicesService],
  exports: [CemeteryServicesService],
})
export class CemeteryServicesModule {}
