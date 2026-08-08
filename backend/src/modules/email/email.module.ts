import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { GmailApiClient } from './gmail-api.client';

@Module({
  providers: [GmailApiClient, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
