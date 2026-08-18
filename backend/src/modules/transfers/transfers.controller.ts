import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { extname, join } from 'path';
import { unlink } from 'fs/promises';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TransfersService } from './transfers.service';
import { AdminOwnershipQueryDto } from './dto/admin-ownership-query.dto';
import { AdminTransferQueryDto } from './dto/admin-transfer-query.dto';
import { AdminTransferRequestQueryDto } from './dto/admin-transfer-request-query.dto';
import { CreateTransferRequestDto } from './dto/create-transfer-request.dto';
import { CreateTransferAppointmentDto } from './dto/create-transfer-appointment.dto';

import {
  CurrentAdminContext,
  type AdminRequestContext,
} from '../../common/decorators/admin-request-context.decorator';


const allowedFiles = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

// Storage for customer-uploaded supporting documents
const customerDocumentStorage = diskStorage({
  destination: './uploads/transfer-request-docs',
  filename: (_request, file, callback) => {
    const safeExtension =
      allowedFiles.get(file.mimetype) ??
      extname(file.originalname).toLowerCase();
    callback(null, `${randomUUID()}${safeExtension}`);
  },
});

const customerDocumentsInterceptor = FilesInterceptor('documents', 10, {
  storage: customerDocumentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const expected = allowedFiles.get(file.mimetype);
    const actual = extname(file.originalname).toLowerCase();
    const valid =
      Boolean(expected) &&
      (expected === actual || (expected === '.jpg' && actual === '.jpeg'));
    callback(
      valid ? null : new BadRequestException('Chỉ chấp nhận PDF, JPG, PNG hoặc WEBP'),
      valid,
    );
  },
});


const transferDocuments = FilesInterceptor('documents', 10, {
  storage: diskStorage({
    destination: './uploads/transfers',
    filename: (_request, file, callback) => {
      const safeExtension =
        allowedFiles.get(file.mimetype) ??
        extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${safeExtension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const expected = allowedFiles.get(file.mimetype);
    const actual = extname(file.originalname).toLowerCase();
    const valid =
      Boolean(expected) &&
      (expected === actual || (expected === '.jpg' && actual === '.jpeg'));
    callback(
      valid
        ? null
        : new BadRequestException('Chỉ chấp nhận PDF, JPG, PNG hoặc WEBP'),
      valid,
    );
  },
});

@UseGuards(JwtAuthGuard)
@Controller()
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Customer endpoints (JWT only, no role guard)
  // ──────────────────────────────────────────────────────────────────────────

  /** Customer gửi yêu cầu chuyển nhượng */
  @Post('my/transfer-requests')
  @UseInterceptors(customerDocumentsInterceptor)
  async createTransferRequest(
    @CurrentUser() user: { id: number },
    @Body('payload') payload: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!payload) throw new BadRequestException('Thiếu dữ liệu yêu cầu');
    let dto: CreateTransferRequestDto;
    try {
      dto = JSON.parse(payload) as CreateTransferRequestDto;
    } catch {
      throw new BadRequestException('Dữ liệu yêu cầu không hợp lệ');
    }
    try {
      return {
        success: true,
        message: 'Yêu cầu chuyển nhượng đã được gửi thành công',
        data: await this.service.createTransferRequest(user.id, dto, files ?? []),
      };
    } catch (error) {
      await Promise.all(
        (files ?? []).map((f) => unlink(f.path).catch(() => undefined)),
      );
      throw error;
    }
  }

  /** Customer xem danh sách yêu cầu của mình */
  @Get('my/transfer-requests')
  async myTransferRequests(@CurrentUser() user: { id: number }) {
    return { success: true, data: await this.service.myTransferRequests(user.id) };
  }

  /** Customer xem chi tiết một yêu cầu */
  @Get('my/transfer-requests/:id')
  async myTransferRequestDetail(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return { success: true, data: await this.service.myTransferRequestDetail(user.id, id) };
  }

  /** Customer hủy yêu cầu */
  @Delete('my/transfer-requests/:id')
  async cancelTransferRequest(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      success: true,
      message: 'Đã hủy yêu cầu chuyển nhượng',
      data: await this.service.cancelTransferRequest(user.id, id),
    };
  }

  /** Customer xác nhận lịch hẹn */
  @Post('my/transfer-requests/:id/confirm-appointment')
  async confirmTransferAppointment(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body('selectedAt') selectedAt?: string,
  ) {
    return {
      success: true,
      message: 'Đã xác nhận lịch hẹn',
      data: await this.service.confirmTransferAppointment(user.id, id, selectedAt),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Admin endpoints (JWT + Role guard)
  // ──────────────────────────────────────────────────────────────────────────

  /** Admin danh sách yêu cầu chuyển nhượng mới */
  @Get('admin/transfer-requests')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminListTransferRequests(@Query() query: AdminTransferRequestQueryDto) {
    return { success: true, data: await this.service.adminListTransferRequests(query) };
  }

  /** Admin chi tiết một yêu cầu */
  @Get('admin/transfer-requests/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminTransferRequestDetail(@Param('id', ParseIntPipe) id: number) {
    return { success: true, data: await this.service.adminTransferRequestDetail(id) };
  }

  /** Admin duyệt yêu cầu */
  @Post('admin/transfer-requests/:id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async approveTransferRequest(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body('adminNote') adminNote?: string,
    @CurrentAdminContext() context?: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Đã duyệt yêu cầu chuyển nhượng',
      data: await this.service.approveTransferRequest(user.id, id, adminNote, context),
    };
  }

  /** Admin từ chối yêu cầu */
  @Post('admin/transfer-requests/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async rejectTransferRequest(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body('adminNote') adminNote?: string,
    @CurrentAdminContext() context?: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Đã từ chối yêu cầu chuyển nhượng',
      data: await this.service.rejectTransferRequest(user.id, id, adminNote, context),
    };
  }

  /** Admin đặt lịch hẹn */
  @Post('admin/transfer-requests/:id/appointment')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async createTransferAppointment(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTransferAppointmentDto,
  ) {
    return {
      success: true,
      message: 'Đã tạo lịch hẹn ký hợp đồng',
      data: await this.service.createTransferAppointment(user.id, id, dto),
    };
  }

  // NOTE: PDF generation, payment, and signed evidence upload use the
  // existing ContractsController endpoints (POST /admin/contracts/:id/...).
  // The admin frontend uses contractId from the approve response.


  /** Admin kích hoạt quyền sở hữu */
  @Post('admin/transfer-requests/:id/activate')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async activateTransferOwnership(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Quyền sở hữu đã được kích hoạt thành công',
      data: await this.service.activateTransferOwnership(user.id, id, context),
    };
  }

  /** Admin download tài liệu customer đính kèm */
  @Get('admin/transfer-requests/documents/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async downloadRequestDocument(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Res() response: Response,
  ) {
    const doc = await this.service.getTransferRequestDocument(user.id, id, true);
    return response.download(
      join(process.cwd(), 'uploads', 'transfer-request-docs', doc.storedFilename),
      doc.originalFilename,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Legacy admin batch-transfer endpoints (preserved for Tab 2 history view)
  // ──────────────────────────────────────────────────────────────────────────

  @Get('admin/transfers/search')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async search(@Query('mode') mode: string, @Query('q') query = '') {
    return { success: true, data: await this.service.search(mode, query) };
  }

  @Get('admin/transfers')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async list(@Query() query: AdminTransferQueryDto) {
    return { success: true, data: await this.service.listRecent(query) };
  }

  @Get('admin/ownership')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async ownership(@Query() query: AdminOwnershipQueryDto) {
    return { success: true, data: await this.service.ownership(query) };
  }

  @Get('admin/transfers/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async detail(@Param('id') id: string) {
    return { success: true, data: await this.service.transferDetail(id) };
  }

  @Post('admin/transfers')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @UseInterceptors(transferDocuments)
  async transfer(
    @CurrentUser() user: { id: number },
    @Body('payload') payload: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    if (!payload) throw new BadRequestException('Thiếu dữ liệu chuyển nhượng');
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new BadRequestException('Dữ liệu chuyển nhượng không hợp lệ');
    }
    return {
      success: true,
      message: 'Chuyển nhượng thành công',
      data: await this.service.transfer(user.id, parsed, files ?? [], context),
    };
  }

  @Get('admin/transfers/documents/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async download(@Param('id') id: string, @Res() response: Response) {
    const document = await this.service.getDocument(id);
    return response.download(
      join(process.cwd(), 'uploads', 'transfers', document.storedFilename),
      document.originalFilename,
    );
  }
}
