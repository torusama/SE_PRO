import { Module } from '@nestjs/common';
import { PlotsModule } from '../plots/plots.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { CemeteryServicesModule } from '../cemetery-services/cemetery-services.module';
import { AgentBookingService } from './agent-booking.service';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentAdminController } from './ai-agent-admin.controller';
import { AiAgentOrchestratorService } from './ai-agent-orchestrator.service';
import { AiAgentService } from './ai-agent.service';
import { AgentToolRegistryService } from './agent-tool-registry.service';
import { BaziRuleService } from './bazi-rule.service';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeEmbeddingService } from './knowledge-embedding.service';
import { NvidiaNemotronService } from './nvidia-nemotron.service';
import { PlotRecommendationService } from './plot-recommendation.service';
import { PlotRankerClient } from './plot-ranker.client';
import { FeedbackService } from './feedback.service';
import { TrainingService } from './training.service';
import { ConversationHistoryService } from './conversation-history.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { ProactiveConciergeService } from './proactive-concierge.service';

import {
  ComparisonAiService,
  DecisionComparisonAiService,
  EmailDraftAiService,
  OpenAiService,
  OpenAiSecondaryService,
} from './openai.service';
import { MultiProviderLlmService } from './multi-provider-llm.service';

import { AutonomousLearningService } from './autonomous-learning.service';
import { LearningAnalyticsService } from './learning-analytics.service';
import { RemindersModule } from '../reminders/reminders.module';
import { AgentInsightsService } from './agent-insights.service';
import { ScheduleModule } from '../schedule/schedule.module';
import { PlotIntroductionService } from './plot-introduction.service';
import { MemorialEmailDraftService } from './memorial-email-draft.service';
import { CustomerProposalService } from './customer-proposal.service';

@Module({
  imports: [
    PlotsModule,
    ReservationsModule,
    CemeteryServicesModule,
    RemindersModule,
    ScheduleModule,
  ],
  controllers: [AiAgentController, AiAgentAdminController],
  providers: [
    AiAgentService,
    AiAgentOrchestratorService,
    AgentToolRegistryService,
    OpenAiService,
    OpenAiSecondaryService,
    ComparisonAiService,
    DecisionComparisonAiService,
    EmailDraftAiService,
    NvidiaNemotronService,
    MultiProviderLlmService,
    PlotRecommendationService,
    PlotRankerClient,
    BaziRuleService,
    KnowledgeService,
    KnowledgeEmbeddingService,
    FeedbackService,
    TrainingService,
    ConversationHistoryService,
    ConversationMemoryService,
    AgentBookingService,
    ProactiveConciergeService,
    AutonomousLearningService,
    LearningAnalyticsService,
    AgentInsightsService,
    PlotIntroductionService,
    MemorialEmailDraftService,
    CustomerProposalService,
  ],
  exports: [AiAgentService, PlotRecommendationService, BaziRuleService],
})
export class AiAgentModule {}
