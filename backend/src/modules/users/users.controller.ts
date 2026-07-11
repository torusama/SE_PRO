import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsBoolean } from 'class-validator';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

interface AuthUser {
  id: number;
  email: string;
  role: string;
  fullName: string;
  phone: string;
}

class UpdateUserStatusDto {
  @IsBoolean()
  isActive!: boolean;
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
      new BadRequestException('Only JPG, PNG, or WEBP images are allowed'),
      false,
    );
    return;
  }
  callback(null, true);
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class  UsersController {
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
    if (!file) throw new BadRequestException('No file uploaded');
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return {
      success: true,
      message: 'Avatar updated',
      data: await this.usersService.updateAvatar(user.id, avatarUrl),
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
      ),
    };
  }

  @Get('admin/users')
  @Roles('admin')
  async findAll() {
    return { success: true, data: await this.usersService.findAll() };
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
  ) {
    return {
      success: true,
      message: 'User status updated',
      data: await this.usersService.updateStatus(Number(id), dto.isActive),
    };
  }
}
