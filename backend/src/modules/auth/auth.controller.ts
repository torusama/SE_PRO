import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

function extractRequestInfo(req: Request) {
  return {
    ip: req.ip ?? req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return {
      success: true,
      message: 'Registered',
      data: await this.authService.register(dto, extractRequestInfo(req)),
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
