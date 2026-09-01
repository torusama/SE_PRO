import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FamilyService } from './family.service';
import { FamilyInvitationService } from './family-invitation.service';
import { FamilyLifecycleService } from './family-lifecycle.service';
import { ResourcePermissionService } from './resource-permission.service';
import {
  CreateFamilyDto,
  FamilyPlotDto,
  GrantResourcePermissionDto,
  InviteFamilyMemberDto,
} from './dto';
import type { AuthUser } from './deceased.types';

@UseGuards(JwtAuthGuard)
@Controller()
export class FamilyController {
  constructor(
    private readonly families: FamilyService,
    private readonly invitations: FamilyInvitationService,
    private readonly lifecycle: FamilyLifecycleService,
    private readonly permissions: ResourcePermissionService,
  ) {}
  @Get('families') list(@CurrentUser() u: AuthUser) {
    return this.families.list(u.id);
  }
  @Post('families') create(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateFamilyDto,
  ) {
    return this.families.create(u, d);
  }
  @Get('families/:id/plots') plots(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.families.plots(u, +id);
  }
  @Get('families/:id/members') members(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.families.members(u, +id);
  }
  @Post('families/:id/plots') addPlot(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: FamilyPlotDto,
  ) {
    return this.families.addPlot(u, +id, d.plotId);
  }
  @Delete('families/:id/plots/:plotId') removePlot(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Param('plotId') p: string,
  ) {
    return this.families.removePlot(u, +id, +p);
  }
  @Post('families/:id/invitations') invite(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: InviteFamilyMemberDto,
  ) {
    return this.families.invite(u, +id, d.inviteeEmail);
  }
  @Get('my/family-invitations') myInvites(@CurrentUser() u: AuthUser) {
    return this.families.invitations(u.id);
  }
  @Patch('family-invitations/:id/accept') accept(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.invitations.accept(+id, u.id);
  }
  @Patch('family-invitations/:id/reject') reject(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.invitations.reject(+id, u.id);
  }
  @Delete('families/:id/members/:userId') removeMember(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Param('userId') m: string,
  ) {
    return this.families.removeMember(u, +id, +m);
  }
  @Post('families/:id/permissions') grant(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: GrantResourcePermissionDto,
  ) {
    return this.permissions.grant(u, +id, d);
  }
  @Get('families/:id/permissions') grants(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.permissions.list(u, +id);
  }
  @Delete('families/:id/permissions/:permissionId') revoke(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Param('permissionId') p: string,
  ) {
    return this.permissions.revoke(u, +id, +p);
  }
  @Post('families/:id/disable') disable(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.lifecycle.disable(u, +id);
  }
  @Post('families/:id/enable') enable(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.lifecycle.enable(u, +id);
  }
  @Delete('families/:id') remove(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.lifecycle.remove(u, +id);
  }
}
