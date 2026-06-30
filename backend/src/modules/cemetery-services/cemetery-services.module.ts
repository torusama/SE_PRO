import { Module } from '@nestjs/common';
import { CemeteryServicesController } from './cemetery-services.controller';
import { CemeteryServicesService } from './cemetery-services.service';

@Module({ controllers: [CemeteryServicesController], providers: [CemeteryServicesService] })
export class CemeteryServicesModule {}
