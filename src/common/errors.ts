import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (message = '请求参数不合法', details?: unknown) =>
    new AppError('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST, details),
  duplicateSku: (sku: string) =>
    new AppError('DUPLICATE_SKU', `SKU 已存在: ${sku}`, HttpStatus.CONFLICT),
  materialNotFound: (sku: string) =>
    new AppError('MATERIAL_NOT_FOUND', `辅料不存在: ${sku}`, HttpStatus.NOT_FOUND),
  materialDisabled: (sku: string) =>
    new AppError('MATERIAL_DISABLED', `辅料已停用: ${sku}`, HttpStatus.CONFLICT),
  stockInsufficient: (sku: string) =>
    new AppError('STOCK_INSUFFICIENT', `可用库存不足: ${sku}`, HttpStatus.CONFLICT),
  movementNotFound: (id: number) =>
    new AppError('MOVEMENT_NOT_FOUND', `流水不存在: ${id}`, HttpStatus.NOT_FOUND),
  alreadyReversed: (id: number) =>
    new AppError('ALREADY_REVERSED', `流水已冲正: ${id}`, HttpStatus.CONFLICT),
  notificationNotFound: (id: number) =>
    new AppError('NOTIFICATION_NOT_FOUND', `站内消息不存在: ${id}`, HttpStatus.NOT_FOUND),
  requestNotFound: (id: number) =>
    new AppError('REQUEST_NOT_FOUND', `采购申请不存在: ${id}`, HttpStatus.NOT_FOUND),
  orderNotFound: (id: number) =>
    new AppError('ORDER_NOT_FOUND', `采购订单不存在: ${id}`, HttpStatus.NOT_FOUND),
  rejectReasonRequired: () =>
    new AppError('REJECT_REASON_REQUIRED', '驳回原因必填', HttpStatus.BAD_REQUEST),
  illegalTransition: (from: string, action: string) =>
    new AppError(
      'ILLEGAL_STATE_TRANSITION',
      `当前状态 ${from} 不允许执行 ${action}`,
      HttpStatus.CONFLICT,
    ),
  orderNotOpen: (id: number) =>
    new AppError('ORDER_NOT_OPEN', `采购订单未处于 OPEN: ${id}`, HttpStatus.CONFLICT),
  duplicateOrder: (requestNo: string) =>
    new AppError('DUPLICATE_ORDER', `申请已有采购订单: ${requestNo}`, HttpStatus.CONFLICT),
  idempotencyConflict: (key: string) =>
    new AppError('IDEMPOTENCY_CONFLICT', `幂等键已被其他请求使用: ${key}`, HttpStatus.CONFLICT),
  unauthorized: (message = '未登录或登录已过期，请重新登录') =>
    new AppError('UNAUTHORIZED', message, HttpStatus.UNAUTHORIZED),
  invalidCredentials: () =>
    new AppError('INVALID_CREDENTIALS', '用户名或密码错误', HttpStatus.UNAUTHORIZED),
  forbidden: (scope = '') =>
    new AppError('FORBIDDEN', scope ? `当前角色无权执行该操作（需要 ${scope}）` : '当前角色无权执行该操作', HttpStatus.FORBIDDEN),
  userNotFound: (username: string) =>
    new AppError('USER_NOT_FOUND', `用户不存在: ${username}`, HttpStatus.NOT_FOUND),
  duplicateUser: (username: string) =>
    new AppError('DUPLICATE_USER', `用户名已存在: ${username}`, HttpStatus.CONFLICT),
  userDisabled: (username: string) =>
    new AppError('USER_DISABLED', `用户已停用: ${username}`, HttpStatus.CONFLICT),
  dictionaryNotFound: (id: number) =>
    new AppError('DICTIONARY_NOT_FOUND', `字典项不存在: ${id}`, HttpStatus.NOT_FOUND),
  duplicateDictionary: (type: string, value: string) =>
    new AppError('DUPLICATE_DICTIONARY', `字典项已存在: ${type}/${value}`, HttpStatus.CONFLICT),
  dictionaryInUse: (value: string) =>
    new AppError('DICTIONARY_IN_USE', `该字典项仍被物料使用，不能停用或删除: ${value}`, HttpStatus.CONFLICT),
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();

    if (exception instanceof AppError) {
      response.status(exception.httpStatus).json({
        code: exception.code,
        message: exception.message,
        ...(exception.details === undefined ? {} : { details: exception.details }),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const payload =
        typeof body === 'string'
          ? { message: body }
          : (body as Record<string, unknown>);
      response.status(status).json({
        code: status === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : 'HTTP_ERROR',
        message: Array.isArray(payload.message)
          ? '请求参数不合法'
          : String(payload.message ?? exception.message),
        details: payload,
      });
      return;
    }

    // eslint-disable-next-line no-console
    console.error('Unhandled error:', exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: '服务内部错误',
    });
  }
}
