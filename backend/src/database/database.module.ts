import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { MigrationRunnerService } from './migration-runner.service';

@Global()
@Module({
  providers: [MigrationRunnerService, DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
