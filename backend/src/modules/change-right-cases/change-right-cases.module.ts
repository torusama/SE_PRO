import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ChangeRightCasesController } from './change-right-cases.controller';
import { ChangeRightCasesService } from './change-right-cases.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ChangeRightCasesController],
  providers: [ChangeRightCasesService],
})
export class ChangeRightCasesModule {}

