import { Module } from '@nestjs/common';
import { AuthorizedPersonsController } from './authorized-persons.controller';
import { AuthorizedPersonsService } from './authorized-persons.service';

@Module({
  controllers: [AuthorizedPersonsController],
  providers: [AuthorizedPersonsService],
})
export class AuthorizedPersonsModule {}
