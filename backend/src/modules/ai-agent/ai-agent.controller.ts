import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiAgentService } from './ai-agent.service';

@Controller('ai-agent')
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  @Post('recommend')
  async recommend(@Body() body: any) { return { success: true, data: await this.aiAgentService.recommend(body) }; }

  @Post('create-draft-reservation')
  @UseGuards(JwtAuthGuard)
  async createDraft(@CurrentUser() user: any, @Body() body: any) {
    return { success: true, message: 'AI draft reservation created', data: await this.aiAgentService.createDraftReservation(user.id, body) };
  }
}
