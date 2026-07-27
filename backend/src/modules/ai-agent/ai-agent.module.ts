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
import { NvidiaNemotronService } from './nvidia-nemotron.service';
import { PlotRecommendationService } from './plot-recommendation.service';
import { PlotRankerClient } from './plot-ranker.client';
import { FeedbackService } from './feedback.service';
import { TrainingService } from './training.service';
import { ConversationHistoryService } from './conversation-history.service';

import { OpenAiService, OpenAiSecondaryService } from './openai.service';
import { MultiProviderLlmService } from './multi-provider-llm.service';

@Module({
  imports: [PlotsModule, ReservationsModule, CemeteryServicesModule],
  controllers: [AiAgentController, AiAgentAdminController],
  providers: [
    AiAgentService,
    AiAgentOrchestratorService,
    AgentToolRegistryService,
    OpenAiService,
    OpenAiSecondaryService,
    NvidiaNemotronService,
    MultiProviderLlmService,
    PlotRecommendationService,
    PlotRankerClient,
    BaziRuleService,
    KnowledgeService,
    FeedbackService,
    TrainingService,
    ConversationHistoryService,
    AgentBookingService,
  ],
  exports: [AiAgentService, PlotRecommendationService, BaziRuleService],
})
export class AiAgentModule {}
