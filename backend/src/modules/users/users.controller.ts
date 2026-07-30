import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateIdCardDto } from './dto/update-id-card.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { UsersService } from './users.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import {
  CurrentAdminContext,
  type AdminRequestContext,
} from '../../common/decorators/admin-request-context.decorator';

interface AuthUser {
  id: number;
  email: string;
  role: string;
  fullName: string;
  phone: string;
}

// Trường tối thiểu cần dùng từ file multer đã lưu ổ đĩa. Định nghĩa cục bộ thay vì
// dựa vào namespace toàn cục `Express.Multer.File` để tránh lỗi biên dịch khi
// @types/multer chưa được cài/resolve trong môi trường của người phát triển
// (chỉ cần chạy `npm install` trong thư mục backend/ là đủ, nhưng type ở đây
// không phụ thuộc vào việc đó).
interface UploadedDiskFile {
  filename: string;
  originalname: string;
  mimetype: string;
}

const AVATAR_UPLOAD_DIR = './uploads/avatars';

const avatarFileFilter = (
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, accept: boolean) => void,
) => {
  if (!/^image\/(jpe?g|png|webp)$/.test(file.mimetype)) {
    callback(
      new BadRequestException(
        'Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP.',
      ),
      false,
    );
    return;
  }
  callback(null, true);
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users/me')
  async me(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.usersService.me(user.id) };
  }

  @Get('users/me/stats')
  async myStats(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.usersService.stats(user.id) };
  }

  @Patch('users/me')
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return {
      success: true,
      message: 'Profile updated',
      data: await this.usersService.updateProfile(user.id, dto),
    };
  }

  @Post('users/me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: AVATAR_UPLOAD_DIR,
        filename: (_req, file, callback) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          callback(null, `avatar-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: avatarFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: UploadedDiskFile,
  ) {
    if (!file)
      throw new BadRequestException('Vui lòng chọn một tệp để tải lên.');
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return {
      success: true,
      message: 'Avatar updated',
      data: await this.usersService.updateAvatar(user.id, avatarUrl),
    };
  }

  @Post('users/me/password/send-otp')
  async sendPasswordChangeOtp(@CurrentUser() user: AuthUser) {
    return {
      success: true,
      data: await this.usersService.sendPasswordChangeOtp(user.id),
    };
  }

  @Patch('users/me/password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return {
      success: true,
      message: 'Password changed',
      data: await this.usersService.changePassword(
        user.id,
        dto.currentPassword,
        dto.newPassword,
        dto.otpCode,
      ),
    };
  }

  // CCCD/Hộ chiếu là dữ liệu nhạy cảm: GET /users/me chỉ trả bản che số.
  // Muốn xem/sửa số đầy đủ, người dùng phải nhập lại mật khẩu đăng nhập ở đây,
  // dù JWT vẫn còn hiệu lực.
  @Post('users/me/id-card/reveal')
  async revealIdCard(
    @CurrentUser() user: AuthUser,
    @Body() dto: VerifyPasswordDto,
  ) {
    return {
      success: true,
      data: await this.usersService.revealIdCard(user.id, dto.password),
    };
  }

  @Patch('users/me/id-card')
  async updateIdCard(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateIdCardDto,
  ) {
    return {
      success: true,
      message: 'ID card updated',
      data: await this.usersService.updateIdCard(
        user.id,
        dto.password,
        dto.idCardNumber,
      ),
    };
  }

  // --- Xác thực email đăng nhập của chính chủ tài khoản ---
  @Post('users/me/email/send-otp')
  async sendOwnEmailOtp(@CurrentUser() user: AuthUser) {
    return {
      success: true,
      data: await this.usersService.sendOwnEmailOtp(user.id),
    };
  }

  @Post('users/me/email/verify-otp')
  async verifyOwnEmailOtp(
    @CurrentUser() user: AuthUser,
    @Body() dto: VerifyOtpDto,
  ) {
    return {
      success: true,
      data: await this.usersService.verifyOwnEmailOtp(user.id, dto.code),
    };
  }

  // --- Xác thực số điện thoại ---
  @Post('users/me/phone/send-otp')
  async sendPhoneOtp(@CurrentUser() user: AuthUser) {
    return {
      success: true,
      data: await this.usersService.sendPhoneOtp(user.id),
    };
  }

  @Post('users/me/phone/verify-otp')
  async verifyPhoneOtp(
    @CurrentUser() user: AuthUser,
    @Body() dto: VerifyOtpDto,
  ) {
    return {
      success: true,
      data: await this.usersService.verifyPhoneOtp(user.id, dto.code),
    };
  }

  // --- Xác thực email của người liên hệ khẩn cấp ---
  @Post('users/me/emergency-contact/send-otp')
  async sendEmergencyEmailOtp(@CurrentUser() user: AuthUser) {
    return {
      success: true,
      data: await this.usersService.sendEmergencyEmailOtp(user.id),
    };
  }

  @Post('users/me/emergency-contact/verify-otp')
  async verifyEmergencyEmailOtp(
    @CurrentUser() user: AuthUser,
    @Body() dto: VerifyOtpDto,
  ) {
    return {
      success: true,
      data: await this.usersService.verifyEmergencyEmailOtp(user.id, dto.code),
    };
  }

  @Get('admin/users')
  @Roles('admin')
  async findAll(@Query() query: AdminUserQueryDto) {
    return { success: true, data: await this.usersService.findAll(query) };
  }

  @Get('admin/users/:id')
  @Roles('admin')
  async findById(@Param('id') id: string) {
    return {
      success: true,
      data: await this.usersService.findById(Number(id)),
    };
  }

  @Patch('admin/users/:id/status')
  @Roles('admin')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentAdminContext() context: AdminRequestContext,
  ) {
    return {
      success: true,
      message: 'User status updated',
      data: await this.usersService.updateStatus(
        Number(id),
        dto.isActive,
        context,
      ),
    };
  }
}
