import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError, Errors } from '../../common/errors';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../common/auth.decorators';
import { verifyToken, type Role } from '../../common/jwt';

/**
 * 全局守卫：除 @Public() 端点外，必须携带有效 Bearer 令牌。
 * 令牌有效载荷直接作为操作人身份，取代此前可伪造的 X-Actor。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header = request.headers?.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const payload = token ? verifyToken(token) : null;
    if (!payload) throw Errors.unauthorized();

    request.user = { username: payload.sub, displayName: payload.name, role: payload.role };
    return true;
  }
}

/** 角色守卫：端点标注 @Roles(...) 时校验；未标注则任意登录用户可访问。 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: Role } | undefined;
    if (!user?.role) throw Errors.unauthorized();
    if (!required.includes(user.role)) throw Errors.forbidden(required.join(' / '));
    return true;
  }
}

export { AppError };
