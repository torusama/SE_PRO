import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditQueryDto } from './dto/admin-audit-query.dto';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAuditController {
  constructor(private readonly service: AdminAuditService) {}

  @Get()
  async list(@Query() query: AdminAuditQueryDto) {
    return {
      success: true,
      message: 'Đã tải nhật ký hoạt động',
      data: await this.service.list(query),
    };
  }

  @Get(':id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: 'Đã tải chi tiết nhật ký',
      data: await this.service.detail(id),
    };
  }
}
