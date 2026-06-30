import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UsersService } from './users.service';

class UpdateUserStatusDto {
  @IsBoolean()
  isActive: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users/me')
  async me(@CurrentUser() user: any) {
    return { success: true, data: await this.usersService.me(user.id) };
  }

  @Get('admin/users')
  @Roles('admin')
  async findAll() {
    return { success: true, data: await this.usersService.findAll() };
  }

  @Get('admin/users/:id')
  @Roles('admin')
  async findById(@Param('id') id: string) {
    return { success: true, data: await this.usersService.findById(Number(id)) };
  }

  @Patch('admin/users/:id/status')
  @Roles('admin')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return {
      success: true,
      message: 'User status updated',
      data: await this.usersService.updateStatus(Number(id), dto.isActive),
    };
  }
}
