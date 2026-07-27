import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SendRegistrationOtpDto } from './dto/send-registration-otp.dto';
import { VerifyRegistrationOtpDto } from './dto/verify-registration-otp.dto';

function extractRequestInfo(req: Request) {
  return {
    ip: req.ip ?? req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/email/send-otp')
  async sendRegistrationOtp(@Body() dto: SendRegistrationOtpDto) {
    return {
      success: true,
      message: 'Mã OTP đã được gửi tới email',
      data: await this.authService.sendRegistrationOtp(dto.email),
    };
  }

  @Post('register/email/verify-otp')
  async verifyRegistrationOtp(@Body() dto: VerifyRegistrationOtpDto) {
    return {
      success: true,
      message: 'Email đã được xác thực',
      data: await this.authService.verifyRegistrationOtp(
        dto.email,
        dto.otpCode,
      ),
    };
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return {
      success: true,
      message: 'Tài khoản đã được tạo thành công',
      data: await this.authService.register(dto),
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return {
      success: true,
      message: 'Logged in',
      data: await this.authService.login(dto, extractRequestInfo(req)),
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    return { success: true, data: await this.authService.me(user.id) };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: { jti?: string }) {
    return {
      success: true,
      message: 'Logged out',
      data: await this.authService.logout(user.jti),
    };
  }
}
