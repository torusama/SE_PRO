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
import { readFile, unlink } from 'fs/promises';
import { basename, extname, join } from 'path';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ContractsService } from './contracts.service';
import { UpdateInheritanceDto } from './dto/update-inheritance.dto';
import { AdminContractQueryDto } from './dto/admin-contract-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import {
  CurrentAdminContext,
  type AdminRequestContext,
} from '../../common/decorators/admin-request-context.decorator';

const signedEvidenceTypes = new Map<string, string[]>([
  ['.pdf', ['application/pdf']],
  ['.doc', ['application/msword']],
  [
    '.docx',
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  ],
]);
const genericDocumentMimeTypes = new Set(['application/octet-stream']);

export function decodeMultipartFilename(filename: string) {
  if ([...filename].some((character) => character.codePointAt(0)! > 255)) {
    return filename;
  }

  const decoded = Buffer.from(filename, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') || decoded.includes('\0')
    ? filename
    : decoded;
}

export function isSignedEvidenceDocument(
  mimetype: string,
  originalname: string,
) {
  const extension = extname(originalname).toLowerCase();
  const expectedMimeTypes = signedEvidenceTypes.get(extension);
  return Boolean(
    expectedMimeTypes &&
      (expectedMimeTypes.includes(mimetype) ||
        genericDocumentMimeTypes.has(mimetype)),
  );
}

export function hasSignedEvidenceSignature(
  content: Buffer,
  originalname: string,
) {
  const extension = extname(originalname).toLowerCase();
  if (extension === '.pdf') {
    return content.subarray(0, 1024).includes(Buffer.from('%PDF-'));
  }
  if (extension === '.doc') {
    return content
      .subarray(0, 8)
      .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  if (extension === '.docx') {
    return (
      content.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
      content.includes(Buffer.from('word/')) &&
      content.includes(Buffer.from('[Content_Types].xml'))
    );
  }
  return false;
}

const signedEvidenceUpload = FilesInterceptor('evidence', 10, {
  storage: diskStorage({
    destination: './uploads/contract-evidence',
    filename: (_request, file, callback) =>
      callback(
        null,
        `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
      ),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    file.originalname = decodeMultipartFilename(file.originalname);
    const valid = isSignedEvidenceDocument(file.mimetype, file.originalname);
    callback(
      valid
        ? null
        : new BadRequestException(
            'Chỉ chấp nhận tệp PDF, DOC hoặc DOCX',
          ),
      valid,
    );
  },
});

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('admin/contracts')
  @Roles('admin')
  async adminList(@Query() query: AdminContractQueryDto) {
    return {
      success: true,
      data: await this.contractsService.adminList(query),
    };
  }

  @Get('admin/contracts/:id')
  @Roles('admin')
  async adminOne(@Param('id') id: string) {
    return {
      success: true,
      data: await this.contractsService.adminOne(Number(id)),
    };
  }

  @Post('admin/contracts/from-reservation/:reservationId')
  @Roles('admin')
  async fromReservation(
    @CurrentUser() user: any,
    @Param('reservationId') reservationId: string,
  ) {
    return {
      success: true,
      message: 'Contracts created',
      data: await this.contractsService.createFromReservation(
        Number(reservationId),
        user.id,
      ),
    };
  }

  @Patch('admin/contracts/:id/status')
  @Roles('admin')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return {
      success: true,
      message: 'Contract status updated',
      data: await this.contractsService.updateStatus(Number(id), status),
    };
  }

  @Post('admin/contracts/:id/payments')
  @Roles('admin')
  async addPayment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: RecordPaymentDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Payment added',
      data: await this.contractsService.addPayment(
        Number(id),
        body,
        user.id,
        context,
      ),
    };
  }

  @Patch('admin/contracts/:id/inheritance')
  @Roles('admin')
  async updateInheritance(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: UpdateInheritanceDto,
  ) {
    return {
      success: true,
      message: 'Đã cập nhật nội dung thừa kế',
      data: await this.contractsService.updateInheritance(
        Number(id),
        body.content,
        user.id,
      ),
    };
  }

  @Post('admin/contracts/:id/generated-pdf')
  @Roles('admin')
  async markPdfGenerated(
    @CurrentUser() user: { id: number },
    @Param('id') id: string,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Đã ghi nhận bản PDF hợp đồng',
      data: await this.contractsService.markPdfGenerated(
        Number(id),
        user.id,
        context,
      ),
    };
  }

  @Post('admin/contracts/:id/signed-evidence')
  @Roles('admin')
  @UseInterceptors(signedEvidenceUpload)
  async uploadSignedEvidence(
    @CurrentUser() user: { id: number },
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      for (const file of files ?? []) {
        if (
          !hasSignedEvidenceSignature(
            await readFile(file.path),
            file.originalname,
          )
        ) {
          throw new BadRequestException(
            `Tệp ${file.originalname} không có nội dung đúng định dạng PDF, DOC hoặc DOCX`,
          );
        }
      }
      return {
        success: true,
        message: 'Đã lưu tài liệu hợp đồng ký offline',
        data: await this.contractsService.saveSignedEvidence(
          Number(id),
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

  @Get('admin/contracts/:id/signed-evidence/:filename')
  @Roles('admin')
  async signedEvidence(
    @Param('id') id: string,
    @Param('filename') filename: string,
    @Res() response: Response,
  ) {
    const evidence = await this.contractsService.getSignedEvidence(
      Number(id),
      basename(filename),
    );
    return response.sendFile(evidence.filename, {
      root: join(process.cwd(), 'uploads', 'contract-evidence'),
      headers: {
        'Content-Type': evidence.mimeType,
        'Content-Disposition': `inline; filename="${evidence.filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  }

  @Post('admin/contracts/:id/activate-ownership')
  @Roles('admin')
  async activateOwnership(
    @CurrentUser() user: { id: number },
    @Param('id') id: string,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'Đã kích hoạt hợp đồng và quyền sở hữu',
      data: await this.contractsService.activateOwnership(
        Number(id),
        user.id,
        context,
      ),
    };
  }

  @Get('my/contracts')
  async my(@CurrentUser() user: any) {
    return { success: true, data: await this.contractsService.my(user.id) };
  }

  @Get('my/contracts/:id')
  async myOne(@CurrentUser() user: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.contractsService.myOne(user.id, Number(id)),
    };
  }
}
