import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 操作人。优先取登录令牌中的用户名（不可伪造）；
 * 未登录场景（AUTH_DISABLED 或测试直调）回退到 X-Actor，缺省 system。
 */
export const Actor = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest();

  const user = request.user as { username?: string } | undefined;
  if (user?.username) return user.username;

  const header = request.headers?.['x-actor'];
  if (Array.isArray(header)) return header[0] || 'system';
  return typeof header === 'string' && header.trim() ? header.trim() : 'system';
});
