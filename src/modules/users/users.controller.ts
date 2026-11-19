import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto, UserQueryDto } from './dto';
import { ChangePasswordDto } from '../audit/dto';
import { CurrentUser, Roles } from '../../common/auth.decorators';
import type { AuthUser } from '../../common/jwt';
import { AuditService } from '../audit/audit.service';

@Controller('api/v1/users')
export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles('supervisor')
  findAll(@Query() query: UserQueryDto) {
    return this.service.findAll(query);
  }

  @Post()
  @Roles('supervisor')
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    const user = this.service.create(dto);
    this.audit.log(actor, {
      action: 'USER_CREATE',
      resource: 'user',
      resourceId: user.username,
      detail: { role: user.role },
    });
    return user;
  }

  @Patch(':id')
  @Roles('supervisor')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const user = this.service.update(id, dto);
    this.audit.log(actor, {
      action: 'USER_UPDATE',
      resource: 'user',
      resourceId: user.username,
      detail: { role: user.role, status: user.status },
    });
    return user;
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @Roles('supervisor')
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const result = this.service.resetPassword(id, dto);
    this.audit.log(actor, {
      action: 'USER_RESET_PASSWORD',
      resource: 'user',
      resourceId: result.username,
    });
    return result;
  }

  /** 修改自己的密码：任意登录用户可用。 */
  @Post('me/password')
  @HttpCode(200)
  changeOwnPassword(@Body() dto: ChangePasswordDto, @CurrentUser() actor: AuthUser) {
    return this.service.changeOwnPassword(actor, dto.password);
  }
}
