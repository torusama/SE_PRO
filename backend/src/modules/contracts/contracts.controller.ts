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

const signedEvidenceTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const signedEvidenceUpload = FilesInterceptor('evidence', 10, {
  storage: diskStorage({
    destination: './uploads/contract-evidence',
    filename: (_request, file, callback) =>
      callback(null, `${randomUUID()}${signedEvidenceTypes.get(file.mimetype)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const expectedExtension = signedEvidenceTypes.get(file.mimetype);
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

  @Post('admin/contracts/:id/signed-evidence')
  @Roles('admin')
  @UseInterceptors(signedEvidenceUpload)
  async uploadSignedEvidence(
    @CurrentUser() user: { id: number },
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      return {
        success: true,
        message: 'Đã lưu ảnh hợp đồng ký offline',
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
