import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { extname, join } from 'path';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminServiceOrderQueryDto } from './dto/admin-service-order-query.dto';
import { CemeteryServicesService } from './cemetery-services.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import {
  CompleteServiceOrderDto,
  UpdateServiceOrderDto,
} from './dto/update-service-order.dto';

const completionImageTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const completionEvidenceUpload = FilesInterceptor('evidence', 10, {
  storage: diskStorage({
    destination: './uploads/service-completions',
    filename: (_request, file, callback) => {
      callback(
        null,
        `${randomUUID()}${completionImageTypes.get(file.mimetype)}`,
      );
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const expectedExtension = completionImageTypes.get(file.mimetype);
    const actualExtension = extname(file.originalname).toLowerCase();
    const valid =
      Boolean(expectedExtension) &&
      (expectedExtension === actualExtension ||
        (expectedExtension === '.jpg' && actualExtension === '.jpeg'));
    callback(
      valid
        ? null
        : new BadRequestException('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP'),
      valid,
    );
  },
});

@Controller()
export class CemeteryServicesController {
  constructor(private readonly service: CemeteryServicesService) {}

  @Get('service-types')
  async serviceTypes() {
    return { success: true, data: await this.service.serviceTypes() };
  }

  @Post('service-orders')
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateServiceOrderDto,
  ) {
    return {
      success: true,
      message: 'Service order created',
      data: await this.service.createOrder(user.id, dto),
    };
  }

  @Get('my/service-orders')
  @UseGuards(JwtAuthGuard)
  async my(@CurrentUser() user: { id: number }) {
    return { success: true, data: await this.service.myOrders(user.id) };
  }

  @Get('my/service-orders/:id')
  @UseGuards(JwtAuthGuard)
  async myOne(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return { success: true, data: await this.service.one(Number(id), user.id) };
  }

  @Get('admin/service-orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminOrders(@Query() query: AdminServiceOrderQueryDto) {
    return { success: true, data: await this.service.adminOrders(query) };
  }

  @Get('admin/service-order-assignees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async assignees() {
    return { success: true, data: await this.service.assignees() };
  }

  @Get('admin/service-orders/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async adminOne(@Param('id') id: string) {
    return { success: true, data: await this.service.one(Number(id)) };
  }

  @Patch('admin/service-orders/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async status(
    @CurrentUser() user: { id: number },
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return {
      success: true,
      message: 'Service order status updated',
      data: await this.service.updateStatus(Number(id), status, user.id),
    };
  }

  @Patch('admin/service-orders/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(
    @CurrentUser() user: { id: number },
    @Param('id') id: string,
    @Body() dto: UpdateServiceOrderDto,
  ) {
    return {
      success: true,
      message: 'Đã cập nhật đơn dịch vụ',
      data: await this.service.update(Number(id), dto, user.id),
    };
  }

  @Post('admin/service-orders/:id/completion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(completionEvidenceUpload)
  async complete(
    @CurrentUser() user: { id: number },
    @Param('id') id: string,
    @Body() body: CompleteServiceOrderDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      return {
        success: true,
        message: 'Đã xác nhận hoàn thành dịch vụ',
        data: await this.service.complete(
          Number(id),
          body,
          user.id,
          files ?? [],
        ),
      };
    } catch (error) {
      await Promise.all(
        (files ?? []).map((file) => unlink(file.path).catch(() => undefined)),
      );
      throw error;
    }
  }

  @Post('service-orders/:id/pay')
  @UseGuards(JwtAuthGuard)
  async pay(@CurrentUser() user: { id: number }, @Param('id') id: string) {
    return {
      success: true,
      message: 'Đã ghi nhận thanh toán, đang chờ xác nhận từ ban quản lý',
      data: await this.service.markPaid(Number(id), user.id),
    };
  }

  @Post('admin/service-orders/:id/confirm-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async confirmPayment(
    @CurrentUser() user: { id: number },
    @Param('id') id: string,
  ) {
    return {
      success: true,
      message: 'Đã xác nhận thanh toán, đơn chuyển sang trạng thái thực hiện',
      data: await this.service.confirmPayment(Number(id), user.id),
    };
  }

  @Get('service-orders/:id/evidence/:filename')
  @UseGuards(JwtAuthGuard)
  async evidence(
    @CurrentUser() user: { id: number; role: string },
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Res() response: Response,
  ) {
    const evidence = await this.service.getEvidence(Number(id), filename, user);
    return response.sendFile(evidence.filename, {
      root: join(process.cwd(), 'uploads', 'service-completions'),
      headers: {
        'Content-Disposition': `inline; filename="${evidence.filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  }
}
