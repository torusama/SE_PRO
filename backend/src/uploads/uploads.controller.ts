import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  image() { return { success: true, data: this.uploadsService.placeholder('image') }; }

  @Post('document')
  document() { return { success: true, data: this.uploadsService.placeholder('document') }; }
}
