import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DeceasedService } from './deceased.service';
import { DeceasedMapService } from './deceased-map.service';
import { ResourcePermissionService } from './resource-permission.service';
import {
  CreateDeceasedProfileDto,
  DeceasedProfileQueryDto,
  GrantResourcePermissionDto,
  UpdateDeceasedProfileDto,
} from './dto';
import type { AuthUser } from './deceased.types';

@UseGuards(JwtAuthGuard)
@Controller('deceased')
export class DeceasedController {
  constructor(
    private readonly service: DeceasedService,
    private readonly mapService: DeceasedMapService,
    private readonly permissions: ResourcePermissionService,
  ) {}
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: DeceasedProfileQueryDto) {
    return this.service.list(u, q).then((data) => ({ success: true, data }));
  }
  @Get('map') map(@CurrentUser() u: AuthUser) {
    return this.mapService.visible(u);
  }
  @Get(':id') one(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service
      .findOne(u, +id)
      .then((data) => ({ success: true, data }));
  }
  @Post() create(
    @CurrentUser() u: AuthUser,
    @Body() d: CreateDeceasedProfileDto,
  ) {
    return this.service.create(u, d).then((data) => ({ success: true, data }));
  }
  @Patch(':id') update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() d: UpdateDeceasedProfileDto,
  ) {
    return this.service
      .update(u, +id, d)
      .then((data) => ({ success: true, data }));
  }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.service.remove(u, +id);
  }
  @Post(':id/restore') restore(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
  ) {
    return this.service.restore(u, +id);
  }
  @Post(':id/permissions') grant(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Query('familyId') familyId: string,
    @Body() d: GrantResourcePermissionDto,
  ) {
    d.resourceType = 'deceased_profile';
    d.resourceId = +id;
    return this.permissions.grant(u, +familyId, d);
  }
  @Delete(':id/permissions/:permissionId') revoke(
    @CurrentUser() u: AuthUser,
    @Query('familyId') familyId: string,
    @Param('permissionId') p: string,
  ) {
    return this.permissions.revoke(u, +familyId, +p);
  }
}
