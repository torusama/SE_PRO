import { Module } from '@nestjs/common';
import { EmailDraftAiService } from '../ai-agent/openai.service';
import { AppointmentEmailDraftService } from './appointment-email-draft.service';
import { AppointmentReminderScheduler } from './appointment-reminder.scheduler';
import { EmailService } from './email.service';
import { GmailApiClient } from './gmail-api.client';

@Module({
  providers: [
    GmailApiClient,
    EmailService,
    EmailDraftAiService,
    AppointmentEmailDraftService,
    AppointmentReminderScheduler,
  ],
  exports: [EmailService],
})
export class EmailModule {}
