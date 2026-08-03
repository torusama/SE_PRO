import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { envConfig } from '../config/env.config';
import { DatabaseModule } from './database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      load: [envConfig],
    }),
    DatabaseModule,
  ],
})
class MigrationCliModule {}

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(MigrationCliModule);
  await app.close();
}

void run().catch((error: unknown) => {
  console.error('Database migration failed', error);
  process.exitCode = 1;
});
