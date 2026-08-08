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
import { DeceasedService } from './deceased.service';
import { DeceasedVerificationService } from './deceased-verification.service';
import {
  ConfigurePlotCapacityDto,
  CreateDeceasedProfileDto,
  DeceasedProfileQueryDto,
  RejectDeceasedProfileDto,
} from './dto';
import type { AuthUser } from './deceased.types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class DeceasedAdminController {
  constructor(
    private readonly service: DeceasedService,
    private readonly verification: DeceasedVerificationService,
  ) {}
  @Get('deceased') list(
    @CurrentUser() u: AuthUser,
    @Query() q: DeceasedProfileQueryDto,
  ) {
    return this.service.list(u, q, true);
  }
  @Post('deceased') create(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateDeceasedProfileDto,
  ) {
    return this.service.create(u, d);
  }
  @Patch('deceased/:id/verify') verify(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.verification.verify(+id, u.id);
  }
  @Patch('deceased/:id/reject') reject(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: RejectDeceasedProfileDto,
  ) {
    return this.verification.reject(+id, u.id, d.reason);
  }
  @Patch('plots/:id/deceased-capacity') capacity(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: ConfigurePlotCapacityDto,
  ) {
    return this.service.configureCapacity(+id, d.capacity, u.id);
  }
}
