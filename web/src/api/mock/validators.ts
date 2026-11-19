import { ApiError } from '../errors';

/** 复刻后端 ValidationPipe：whitelist + forbidNonWhitelisted —— 多余字段直接 400。 */
export function assertNoUnknownFields(body: Record<string, unknown>, allowed: readonly string[]) {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length > 0) {
    throw new ApiError('VALIDATION_ERROR', `请求包含未允许的字段：${extra.join(', ')}`, { extra });
  }
}

export function assertNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError('VALIDATION_ERROR', `${field} 不能为空`, { field });
  }
  return value;
}

export function assertEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new ApiError('VALIDATION_ERROR', `${field} 取值不合法`, { field, allowed });
  }
  return value as T;
}

export function assertInt(value: unknown, field: string, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new ApiError('VALIDATION_ERROR', `${field} 必须为不小于 ${min} 的整数`, { field });
  }
  return value;
}

export function assertOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new ApiError('VALIDATION_ERROR', `${field} 必须为字符串`, { field });
  }
  return value;
}
