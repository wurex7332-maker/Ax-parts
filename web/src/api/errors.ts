/** 后端业务错误码（精确取自后端 src/common/errors.ts）。错误体无 statusCode 字段，分支判断只能用 code。 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'DUPLICATE_SKU',
  'MATERIAL_NOT_FOUND',
  'MATERIAL_DISABLED',
  'STOCK_INSUFFICIENT',
  'MOVEMENT_NOT_FOUND',
  'ALREADY_REVERSED',
  'NOTIFICATION_NOT_FOUND',
  'REQUEST_NOT_FOUND',
  'ORDER_NOT_FOUND',
  'REJECT_REASON_REQUIRED',
  'ILLEGAL_STATE_TRANSITION',
  'ORDER_NOT_OPEN',
  'DUPLICATE_ORDER',
  'IDEMPOTENCY_CONFLICT',
  'INTERNAL_ERROR',
] as const;

export type BusinessErrorCode = (typeof ERROR_CODES)[number];
export type ErrorCode = BusinessErrorCode | 'NETWORK_ERROR' | 'UNKNOWN';

const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: '请求参数不合法，请检查输入项',
  DUPLICATE_SKU: 'SKU 已存在，请更换',
  MATERIAL_NOT_FOUND: '辅料不存在',
  MATERIAL_DISABLED: '辅料已停用，无法执行该操作',
  STOCK_INSUFFICIENT: '可用库存不足',
  MOVEMENT_NOT_FOUND: '流水不存在',
  ALREADY_REVERSED: '流水已冲正',
  NOTIFICATION_NOT_FOUND: '站内消息不存在',
  REQUEST_NOT_FOUND: '采购申请不存在',
  ORDER_NOT_FOUND: '采购订单不存在',
  REJECT_REASON_REQUIRED: '驳回原因必填',
  ILLEGAL_STATE_TRANSITION: '当前状态不允许执行该操作，状态可能已变化',
  ORDER_NOT_OPEN: '采购订单未处于 OPEN 状态',
  DUPLICATE_ORDER: '该申请已存在采购订单',
  IDEMPOTENCY_CONFLICT: '幂等键已被其他请求使用',
  INTERNAL_ERROR: '服务内部错误',
  NETWORK_ERROR:
    '无法连接后端服务。若为联调模式，请通过代理访问（npm run dev 或 npm run preview），直连 3000 端口会因后端未启用 CORS 而失败。',
  UNKNOWN: '操作失败，请稍后重试',
};

export function messageFor(code: ErrorCode): string {
  return MESSAGES[code] ?? MESSAGES.UNKNOWN;
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message || messageFor(code));
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function errorCodeOf(e: unknown): ErrorCode {
  return isApiError(e) ? e.code : 'UNKNOWN';
}

/** 后端 message 为中文原文时优先展示，但保留 code 供分支判断 */
export function displayMessageOf(e: unknown): string {
  if (isApiError(e)) return e.message || messageFor(e.code);
  if (e instanceof Error) return e.message;
  return messageFor('UNKNOWN');
}
