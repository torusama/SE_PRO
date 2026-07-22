import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthorizedPersonsService } from './authorized-persons.service';
import {
  CreateAuthorizedPersonDto,
  UpdateAuthorizedPersonDto,
} from './dto/authorized-person.dto';

interface AuthUser {
  id: number;
}

@Controller('users/me/authorized-persons')
@UseGuards(JwtAuthGuard)
export class AuthorizedPersonsController {
  constructor(private readonly service: AuthorizedPersonsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return { success: true, data: await this.service.list(user.id) };
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateAuthorizedPersonDto,
  ) {
    return { success: true, data: await this.service.create(user.id, dto) };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAuthorizedPersonDto,
  ) {
    return {
      success: true,
      data: await this.service.update(user.id, Number(id), dto),
    };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return {
      success: true,
      data: await this.service.remove(user.id, Number(id)),
    };
  }
}
