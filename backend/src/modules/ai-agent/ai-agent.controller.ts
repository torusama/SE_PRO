import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { AiAgentService } from './ai-agent.service';
import { AdminAiActivityQueryDto } from './dto/admin-ai-activity-query.dto';
import { AiAgentOrchestratorService } from './ai-agent-orchestrator.service';
import { ChatDto } from './dto/chat.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreateAiDraftDto } from './dto/create-ai-draft.dto';
import { RecommendPlotsDto } from './dto/recommend-plots.dto';
import { FeedbackService } from './feedback.service';
import { ConversationHistoryService } from './conversation-history.service';
import { ProactiveConciergeDto } from './dto/proactive-concierge.dto';
import { ProactiveConciergeService } from './proactive-concierge.service';

interface AuthenticatedUser {
  id: number;
  role: string;
}

@Controller('ai-agent')
export class AiAgentController {
  constructor(
    private readonly aiAgentService: AiAgentService,
    private readonly aiAgentOrchestrator: AiAgentOrchestratorService,
    private readonly feedbackService: FeedbackService,
    private readonly conversations: ConversationHistoryService,
    private readonly proactiveConcierge: ProactiveConciergeService,
  ) {}

  @Post('chat')
  @UseGuards(OptionalJwtAuthGuard)
  async chat(
    @CurrentUser() user: AuthenticatedUser | null,
    @Body() dto: ChatDto,
  ) {
    return {
      success: true,
      message: 'AI response generated',
      data: await this.aiAgentOrchestrator.chat(dto, user),
    };
  }

  @Post('proactive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async proactive(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ProactiveConciergeDto,
  ): Promise<{ success: true; message: string; data: unknown }> {
    return {
      success: true,
      message: 'Proactive concierge evaluated',
      data: await this.proactiveConcierge.initiate(user.id, dto),
    };
  }

  @Post('feedback')
  @UseGuards(OptionalJwtAuthGuard)
  async feedback(
    @CurrentUser() user: AuthenticatedUser | null,
    @Body() dto: CreateFeedbackDto,
  ) {
    return {
      success: true,
      message: 'Feedback received and pending verification',
      data: await this.feedbackService.create(dto, user?.id),
    };
  }

  @Get('conversations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'admin')
  async conversationList(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      message: 'AI conversations retrieved',
      data: await this.conversations.list(user.id),
    };
  }

  @Get('conversations/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'admin')
  async conversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ) {
    return {
      success: true,
      message: 'AI conversation retrieved',
      data: await this.conversations.get(user.id, sessionId),
    };
  }

  @Delete('conversations/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer', 'admin')
  async deleteConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ) {
    return {
      success: true,
      message: 'AI conversation deleted',
      data: await this.conversations.remove(user.id, sessionId),
    };
  }

  @Post('recommend')
  async recommend(@Body() dto: RecommendPlotsDto) {
    return {
      success: true,
      message: 'AI plot recommendations retrieved',
      data: await this.aiAgentService.recommend(dto),
    };
  }

  @Post('create-draft-reservation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async createDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAiDraftDto,
  ) {
    return {
      success: true,
      message: 'AI draft reservation created',
      data: await this.aiAgentService.createDraftReservation(user.id, dto),
    };
  }

  @Get('admin/ai-activity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminActivity(@Query() query: AdminAiActivityQueryDto) {
    return {
      success: true,
      data: await this.aiAgentService.adminActivity(query),
    };
  }

  @Get('admin/ai-activity/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminActivityOne(@Param('id') id: string) {
    return {
      success: true,
      data: await this.aiAgentService.adminActivityOne(Number(id)),
    };
  }
}
