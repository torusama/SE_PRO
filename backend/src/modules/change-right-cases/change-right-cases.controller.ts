import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ChangeRightCasesService } from './change-right-cases.service';
import { CreateChangeRightCaseDto } from './dto/create-change-right-case.dto';
import { CreatePolicyVersionDto } from './dto/create-policy-version.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ChangeRightCasesController {
  constructor(private readonly service: ChangeRightCasesService) {}

  @Get('admin/change-right-policies')
  @Roles('admin')
  async policies() { return { success: true, data: await this.service.listPolicies() }; }

  @Post('admin/change-right-policies')
  @Roles('admin')
  async createPolicy(@CurrentUser() user: any, @Body() body: CreatePolicyVersionDto) {
    return { success: true, data: await this.service.createPolicyVersion(user.id, body) };
  }

  @Post('admin/change-right-policies/:id/publish')
  @Roles('admin')
  async publishPolicy(@CurrentUser() user: any, @Param('id') id: string) {
    return { success: true, data: await this.service.publishPolicy(user.id, Number(id)) };
  }

  @Get('change-right-cases')
  async mine(@CurrentUser() user: any) {
    return { success: true, data: await this.service.listMine(user.id) };
  }

  @Get('change-right-cases/:id')
  async one(@CurrentUser() user: any, @Param('id') id: string) {
    return { success: true, data: await this.service.getMine(user.id, id) };
  }

  @Post('change-right-cases')
  async create(@CurrentUser() user: any, @Body() body: CreateChangeRightCaseDto) {
    return { success: true, data: await this.service.createDraft(user.id, body) };
  }

  @Post('change-right-cases/:id/submit')
  async submit(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('lockVersion') lockVersion: number,
  ) {
    return { success: true, data: await this.service.submit(user.id, id, lockVersion) };
  }
}

