import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SessionsService } from './sessions.service';

interface AuthUser {
  id: number;
  jti?: string;
}

@Controller('users/me/sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return {
      success: true,
      data: await this.sessionsService.listSessions(user.id, user.jti ?? null),
    };
  }

  @Delete(':id')
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return {
      success: true,
      data: await this.sessionsService.revokeSession(user.id, Number(id)),
    };
  }

  @Post('revoke-others')
  async revokeOthers(@CurrentUser() user: AuthUser) {
    return {
      success: true,
      data: await this.sessionsService.revokeOtherSessions(
        user.id,
        user.jti ?? null,
      ),
    };
  }
}
