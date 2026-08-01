import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RetrainModelDto } from './dto/retrain-model.dto';
import { ReviewFeedbackDto } from './dto/review-feedback.dto';
import { FeedbackService } from './feedback.service';
import { TrainingService } from './training.service';
import { ConversationHistoryService } from './conversation-history.service';
import { AdminAiActivityQueryDto } from './dto/admin-ai-activity-query.dto';
import { LearningAnalyticsService } from './learning-analytics.service';

interface AdminUser {
  id: number;
}

@Controller('admin/ai-agent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AiAgentAdminController {
  constructor(
    private readonly feedback: FeedbackService,
    private readonly training: TrainingService,
    private readonly conversations: ConversationHistoryService,
    private readonly analytics: LearningAnalyticsService,
  ) {}

  @Get('conversations')
  async conversationList(@Query() query: AdminAiActivityQueryDto) {
    return {
      success: true,
      message: 'AI conversations retrieved',
      data: await this.conversations.adminList(query),
    };
  }

  @Get('conversations/:id')
  async conversationDetail(@Param('id') id: string) {
    return {
      success: true,
      message: 'AI conversation retrieved',
      data: await this.conversations.adminGet(Number(id)),
    };
  }

  @Get('feedback')
  async listFeedback(@Query('status') status?: string) {
    return {
      success: true,
      message: 'AI feedback retrieved',
      data: await this.feedback.list(status),
    };
  }

  @Get('feedback/:id')
  async getFeedback(@Param('id') id: string) {
    return {
      success: true,
      message: 'AI feedback retrieved',
      data: await this.feedback.get(Number(id)),
    };
  }

  @Patch('feedback/:id/approve')
  async approveFeedback(
    @CurrentUser() user: AdminUser,
    @Param('id') id: string,
    @Body() dto: ReviewFeedbackDto,
  ) {
    return {
      success: true,
      message: 'AI feedback approved',
      data: await this.feedback.review(Number(id), user.id, 'approve', dto),
    };
  }

  @Patch('feedback/:id/reject')
  async rejectFeedback(
    @CurrentUser() user: AdminUser,
    @Param('id') id: string,
    @Body() dto: ReviewFeedbackDto,
  ) {
    return {
      success: true,
      message: 'AI feedback rejected',
      data: await this.feedback.review(Number(id), user.id, 'reject', dto),
    };
  }

  @Post('retrain')
  async retrain(@CurrentUser() user: AdminUser, @Body() dto: RetrainModelDto) {
    return {
      success: true,
      message: 'PlotRanker training completed',
      data: await this.training.retrain(user.id, dto),
    };
  }

  @Get('training-runs')
  async trainingRuns() {
    return {
      success: true,
      message: 'Training runs retrieved',
      data: await this.training.listRuns(),
    };
  }

  @Get('model-versions')
  async modelVersions() {
    return {
      success: true,
      message: 'Model versions retrieved',
      data: await this.training.listModels(),
    };
  }

  @Post('model-versions/:id/deploy')
  async deploy(@CurrentUser() user: AdminUser, @Param('id') id: string) {
    return {
      success: true,
      message: 'Model version deployed',
      data: await this.training.deploy(Number(id), user.id),
    };
  }

  @Post('model-versions/:id/rollback')
  async rollback(@CurrentUser() user: AdminUser, @Param('id') id: string) {
    return {
      success: true,
      message: 'Model version rolled back',
      data: await this.training.rollback(Number(id), user.id),
    };
  }

  @Get('learning-history')
  async learningHistory() {
    return {
      success: true,
      message: 'AI learning history retrieved',
      data: await this.training.learningHistory(),
    };
  }

  @Get('learning-analytics')
  async learningAnalytics(@Query('days') days?: string) {
    return {
      success: true,
      message: 'Application-level learning analytics retrieved',
      data: await this.analytics.dashboard(days),
    };
  }
}
