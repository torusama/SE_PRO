import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return { success: true, message: 'Registered', data: await this.authService.register(dto) };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return { success: true, message: 'Logged in', data: await this.authService.login(dto) };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any) {
    return { success: true, data: await this.authService.me(user.id) };
  }

  @Post('logout')
  logout() {
    return { success: true, message: 'Logged out', data: null };
  }
}
