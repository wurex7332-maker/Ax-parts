import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthUser, Role } from './jwt';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';

/** 标记无需登录即可访问的端点（登录、健康检查）。 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** 限定可访问的角色（不标注表示任意已登录用户）。 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** 取当前登录用户；未登录时由守卫兜底，这里返回 null 便于类型收窄。 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  const request = context.switchToHttp().getRequest();
  return request.user as AuthUser;
});
