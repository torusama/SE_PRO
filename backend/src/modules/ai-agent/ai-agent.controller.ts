import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiAgentService } from './ai-agent.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAiActivityQueryDto } from './dto/admin-ai-activity-query.dto';

@Controller()
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  @Post('ai-agent/recommend')
  async recommend(@Body() body: any) { return { success: true, data: await this.aiAgentService.recommend(body) }; }

  @Post('ai-agent/create-draft-reservation')
  @UseGuards(JwtAuthGuard)
  async createDraft(@CurrentUser() user: any, @Body() body: any) {
    return { success: true, message: 'AI draft reservation created', data: await this.aiAgentService.createDraftReservation(user.id, body) };
  }

  @Get('admin/ai-activity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminActivity(@Query() query: AdminAiActivityQueryDto) {
    return { success: true, data: await this.aiAgentService.adminActivity(query) };
  }

  @Get('admin/ai-activity/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminActivityOne(@Param('id') id: string) {
    return { success: true, data: await this.aiAgentService.adminActivityOne(Number(id)) };
  }
}
