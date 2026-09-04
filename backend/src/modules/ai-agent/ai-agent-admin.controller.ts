import {
  Body,
  Controller,
  Delete,
  Get,
  Optional,
  Param,
  ParseIntPipe,
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
import { KnowledgeService } from './knowledge.service';
import { ReviewKnowledgeDto } from './dto/review-knowledge.dto';
import { ManageKnowledgeDto } from './dto/manage-knowledge.dto';
import { ReviewCustomerProposalDto } from './dto/review-customer-proposal.dto';
import { CustomerProposalService } from './customer-proposal.service';
import { AgentLearningJournalService } from './agent-learning-journal.service';
import { ManageLearningJournalDto } from './dto/manage-learning-journal.dto';
import {
  AdminFeedbackReviewQueryDto,
  AdminKnowledgeReviewQueryDto,
} from './dto/admin-review-query.dto';

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
    private readonly knowledge: KnowledgeService,
    @Optional() private readonly customerProposals?: CustomerProposalService,
    @Optional() private readonly learningJournal?: AgentLearningJournalService,
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
  async conversationDetail(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: 'AI conversation retrieved',
      data: await this.conversations.adminGet(id),
    };
  }

  @Get('feedback')
  async listFeedback(@Query() query: AdminFeedbackReviewQueryDto) {
    return {
      success: true,
      message: 'AI feedback retrieved',
      data: await this.feedback.list(query.status),
    };
  }

  @Get('feedback/:id')
  async getFeedback(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: 'AI feedback retrieved',
      data: await this.feedback.get(id),
    };
  }

  @Patch('feedback/:id/approve')
  async approveFeedback(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewFeedbackDto,
  ) {
    return {
      success: true,
      message: 'AI feedback approved',
      data: await this.feedback.review(id, user.id, 'approve', dto),
    };
  }

  @Patch('feedback/:id/reject')
  async rejectFeedback(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewFeedbackDto,
  ) {
    return {
      success: true,
      message: 'AI feedback rejected',
      data: await this.feedback.review(id, user.id, 'reject', dto),
    };
  }

  @Get('knowledge')
  async listKnowledge(@Query() query: AdminKnowledgeReviewQueryDto) {
    return {
      success: true,
      message: 'AI knowledge proposals retrieved',
      data: await this.knowledge.listKnowledgeForReview(
        query.status,
        query.sourceRole,
      ),
    };
  }

  @Post('knowledge')
  async createKnowledge(
    @CurrentUser() user: AdminUser,
    @Body() dto: ManageKnowledgeDto,
  ) {
    return {
      success: true,
      message: 'Knowledge entry created and activated by administrator',
      data: await this.knowledge.createAdminKnowledge(user.id, dto),
    };
  }

  @Patch('knowledge/:id')
  async updateKnowledge(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ManageKnowledgeDto,
  ) {
    return {
      success: true,
      message: 'Knowledge entry updated and activated by administrator',
      data: await this.knowledge.updateAdminKnowledge(id, user.id, dto),
    };
  }

  @Delete('knowledge/:id')
  async deleteKnowledge(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      success: true,
      message: 'Knowledge entry deleted by administrator',
      data: await this.knowledge.deleteAdminKnowledge(id, user.id),
    };
  }

  @Get('knowledge/:id')
  async getKnowledge(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: 'AI knowledge proposal retrieved',
      data: await this.knowledge.getKnowledgeForReview(id),
    };
  }

  @Patch('knowledge/:id/approve')
  async approveKnowledge(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewKnowledgeDto,
  ) {
    return {
      success: true,
      message: 'AI knowledge proposal approved',
      data: await this.knowledge.reviewKnowledgeProposal(
        id,
        user.id,
        'approve',
        dto.reviewNote,
      ),
    };
  }

  @Patch('knowledge/:id/reject')
  async rejectKnowledge(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewKnowledgeDto,
  ) {
    return {
      success: true,
      message: 'AI knowledge proposal rejected',
      data: await this.knowledge.reviewKnowledgeProposal(
        id,
        user.id,
        'reject',
        dto.reviewNote,
      ),
    };
  }

  @Get('learning-journal')
  async learningJournalList(@Query('limit') limit?: string) {
    return {
      success: true,
      message: 'Privacy-safe AI learning journal retrieved',
      data: this.learningJournal ? await this.learningJournal.list(limit) : [],
    };
  }

  @Patch('learning-journal/:id')
  async updateLearningJournal(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ManageLearningJournalDto,
  ) {
    return {
      success: true,
      message: 'AI learning journal entry updated by administrator',
      data: await this.learningJournal!.update(id, user.id, dto),
    };
  }

  @Patch('learning-journal/:id/approve')
  async approveLearningJournal(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      success: true,
      message: 'AI learning journal entry approved and activated',
      data: await this.learningJournal!.approve(id, user.id),
    };
  }

  @Delete('learning-journal/:id')
  async deleteLearningJournal(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      success: true,
      message: 'AI learning journal entry deleted by administrator',
      data: await this.learningJournal!.delete(id, user.id),
    };
  }

  @Get('customer-proposals')
  async listCustomerProposals(@Query('status') status?: string) {
    return {
      success: true,
      message: 'Customer proposals retrieved',
      data: this.customerProposals
        ? await this.customerProposals.list(status)
        : [],
    };
  }

  @Patch('customer-proposals/:id/accept')
  async acceptCustomerProposal(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewCustomerProposalDto,
  ) {
    return {
      success: true,
      message: 'Customer proposal accepted for management review',
      data: await this.customerProposals!.review(
        id,
        user.id,
        'accept',
        dto.reviewNote,
      ),
    };
  }

  @Patch('customer-proposals/:id/reject')
  async rejectCustomerProposal(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewCustomerProposalDto,
  ) {
    return {
      success: true,
      message: 'Customer proposal rejected',
      data: await this.customerProposals!.review(
        id,
        user.id,
        'reject',
        dto.reviewNote,
      ),
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
  async deploy(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      success: true,
      message: 'Model version deployed',
      data: await this.training.deploy(id, user.id),
    };
  }

  @Post('model-versions/:id/rollback')
  async rollback(
    @CurrentUser() user: AdminUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      success: true,
      message: 'Model version rolled back',
      data: await this.training.rollback(id, user.id),
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
