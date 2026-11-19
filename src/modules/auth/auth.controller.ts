import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto';
import { CurrentUser, Public } from '../../common/auth.decorators';
import type { AuthUser } from '../../common/jwt';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.service.login(dto.username, dto.password);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.service.me(user.username);
  }

  /** JWT 无状态，登出由前端清除令牌即可；保留端点以便前端统一调用。 */
  @Post('logout')
  @HttpCode(200)
  logout() {
    return { ok: true };
  }
}
