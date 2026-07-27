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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { basename, join } from 'path';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ContractsService } from './contracts.service';
import { UpdateInheritanceDto } from './dto/update-inheritance.dto';
import { SignContractDto } from './dto/sign-contract.dto';
import { AdminContractQueryDto } from './dto/admin-contract-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import {
  CurrentAdminContext,
  type AdminRequestContext,
} from '../../common/decorators/admin-request-context.decorator';

const contractPdfUpload = FileInterceptor('pdf', {
  storage: diskStorage({
    destination: './uploads/contracts',
    filename: (_request, file, callback) =>
      callback(
        null,
        `contract-${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname).toLowerCase()}`,
      ),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const valid =
      file.mimetype === 'application/pdf' &&
      extname(file.originalname).toLowerCase() === '.pdf';
    callback(
      valid ? null : new BadRequestException('Only PDF files are accepted'),
      valid,
    );
  },
});

interface UploadedPdf {
  filename: string;
}

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

  @Post('my/contracts/:id/sign')
  async signMine(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: SignContractDto,
  ) {
    if (!body.accepted)
      throw new BadRequestException('Signature consent is required');
    return {
      success: true,
      message: 'Đã ký hợp đồng',
      data: await this.contractsService.signAsBuyer(
        user.id,
        Number(id),
        body.signatureName,
      ),
    };
  }

  @Post('admin/contracts/:id/sign')
  @Roles('admin')
  async signAdmin(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: SignContractDto,
  ) {
    if (!body.accepted)
      throw new BadRequestException('Signature consent is required');
    return {
      success: true,
      message: 'Đã ký hợp đồng',
      data: await this.contractsService.signAsAdmin(
        user.id,
        Number(id),
        body.signatureName,
      ),
    };
  }

  @Post('my/contracts/:id/pdf')
  @UseInterceptors(contractPdfUpload)
  async uploadMyPdf(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile() file?: UploadedPdf,
  ) {
    if (!file) throw new BadRequestException('PDF file is required');
    return {
      success: true,
      message: 'Đã lưu PDF',
      data: await this.contractsService.savePdf(
        Number(id),
        user.id,
        `/uploads/contracts/${file.filename}`,
        false,
      ),
    };
  }

  @Post('admin/contracts/:id/pdf')
  @Roles('admin')
  @UseInterceptors(contractPdfUpload)
  async uploadAdminPdf(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile() file?: UploadedPdf,
  ) {
    if (!file) throw new BadRequestException('PDF file is required');
    return {
      success: true,
      message: 'Đã lưu PDF',
      data: await this.contractsService.savePdf(
        Number(id),
        user.id,
        `/uploads/contracts/${file.filename}`,
        true,
      ),
    };
  }

  @Get('my/contracts/:id/pdf')
  async downloadMyPdf(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const url = await this.contractsService.getPdf(Number(id), user.id, false);
    return response.download(
      join(process.cwd(), 'uploads', 'contracts', basename(url)),
    );
  }

  @Get('admin/contracts/:id/pdf')
  @Roles('admin')
  async downloadAdminPdf(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const url = await this.contractsService.getPdf(Number(id), user.id, true);
    return response.download(
      join(process.cwd(), 'uploads', 'contracts', basename(url)),
    );
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
