import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** 测试项目不做真实鉴权：写操作从 X-Actor 取操作人，缺省 system。 */
export const Actor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.['x-actor'];
    if (Array.isArray(header)) return header[0] || 'system';
    return typeof header === 'string' && header.trim() ? header.trim() : 'system';
  },
);
