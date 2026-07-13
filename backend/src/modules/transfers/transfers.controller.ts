import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
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
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TransfersService } from './transfers.service';

const allowedFiles = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const transferDocuments = FilesInterceptor('documents', 10, {
  storage: diskStorage({
    destination: './uploads/transfers',
    filename: (_request, file, callback) => {
      const safeExtension = allowedFiles.get(file.mimetype) ?? extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${safeExtension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const expected = allowedFiles.get(file.mimetype);
    const actual = extname(file.originalname).toLowerCase();
    const valid = Boolean(expected) && (expected === actual || (expected === '.jpg' && actual === '.jpeg'));
    callback(valid ? null : new BadRequestException('Chỉ chấp nhận PDF, JPG, PNG hoặc WEBP'), valid);
  },
});

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/transfers')
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Get('search')
  async search(@Query('mode') mode: string, @Query('q') query = '') {
    return { success: true, data: await this.service.search(mode, query) };
  }

  @Get()
  async list() {
    return { success: true, data: await this.service.listRecent() };
  }

  @Post()
  @UseInterceptors(transferDocuments)
  async transfer(
    @CurrentUser() user: { id: number },
    @Body('payload') payload: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!payload) throw new BadRequestException('Thiếu dữ liệu chuyển nhượng');
    let parsed: unknown;
    try { parsed = JSON.parse(payload); } catch { throw new BadRequestException('Dữ liệu chuyển nhượng không hợp lệ'); }
    return {
      success: true,
      message: 'Chuyển nhượng thành công',
      data: await this.service.transfer(user.id, parsed, files ?? []),
    };
  }

  @Get('documents/:id')
  async download(@Param('id') id: string, @Res() response: Response) {
    const document = await this.service.getDocument(id);
    return response.download(
      join(process.cwd(), 'uploads', 'transfers', document.storedFilename),
      document.originalFilename,
    );
  }
}
