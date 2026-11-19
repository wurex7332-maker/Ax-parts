import { requestStatusLabel } from '../../domain/enums';
import type { PurchaseRequest, RequestStatus } from '../../domain/types';
import { ApiError } from '../errors';

export type RequestAction = 'APPROVE' | 'REJECT' | 'RESUBMIT' | 'CREATE_ORDER' | 'ARRIVE' | 'CLOSE';

/** 与后端 src/domain/purchase-machine.ts 完全一致 */
const TRANSITIONS: Record<RequestStatus, RequestAction[]> = {
  PENDING: ['APPROVE', 'REJECT', 'RESUBMIT'],
  APPROVED: ['CREATE_ORDER'],
  PURCHASING: ['ARRIVE'],
  ARRIVED: ['CLOSE'],
  COMPLETED: [],
};

const NEXT_STATUS: Partial<Record<RequestAction, RequestStatus>> = {
  APPROVE: 'APPROVED',
  REJECT: 'PENDING',
  RESUBMIT: 'PENDING',
  CREATE_ORDER: 'PURCHASING',
  ARRIVE: 'COMPLETED',
  CLOSE: 'COMPLETED',
};

export function canTransition(status: RequestStatus, action: RequestAction): boolean {
  return TRANSITIONS[status]?.includes(action) ?? false;
}

/** 迁移并写入 statusLabel / version（乐观锁 +1） */
export function transition(request: PurchaseRequest, action: RequestAction, at: string): PurchaseRequest {
  if (!canTransition(request.status, action)) {
    throw new ApiError(
      'ILLEGAL_STATE_TRANSITION',
      `当前状态 ${requestStatusLabel(request.status)} 不允许执行 ${action}`,
    );
  }
  const next = NEXT_STATUS[action];
  if (!next) throw new ApiError('ILLEGAL_STATE_TRANSITION');

  request.status = next;
  request.statusLabel = requestStatusLabel(next);
  request.version += 1;
  request.updatedAt = at;

  if (action === 'RESUBMIT') request.rejectReason = '';
  return request;
}
