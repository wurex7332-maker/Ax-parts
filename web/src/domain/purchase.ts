import { requestStatusLabel } from './enums';
import type { PurchaseRequest, RequestStatus } from './types';

export type RequestAction = 'APPROVE' | 'REJECT' | 'RESUBMIT' | 'CREATE_ORDER' | 'ARRIVE' | 'CLOSE';

/** 与后端 purchase-machine 的迁移表一致；仅用于 UI 预判，不替代后端校验。 */
export const TRANSITIONS: Record<RequestStatus, RequestAction[]> = {
  PENDING: ['APPROVE', 'REJECT', 'RESUBMIT'],
  APPROVED: ['CREATE_ORDER'],
  PURCHASING: ['ARRIVE'],
  ARRIVED: ['CLOSE'],
  COMPLETED: [],
};

export const ACTION_LABEL: Record<RequestAction, string> = {
  APPROVE: '通过',
  REJECT: '驳回',
  RESUBMIT: '重新提交',
  CREATE_ORDER: '生成采购订单',
  ARRIVE: '到货入库',
  CLOSE: '关单',
};

export function canDo(status: RequestStatus, action: RequestAction): boolean {
  return TRANSITIONS[status]?.includes(action) ?? false;
}

/**
 * 步骤条节点。后端把 ARRIVED 作为事务内瞬时态（到货即完成），
 * 因此第 4 节点标注为瞬时态，COMPLETED 时第 4、5 节点同为已达成（PRD §2.3）。
 */
export const STEPPER_STEPS: { status: RequestStatus; label: string; note?: string }[] = [
  { status: 'PENDING', label: '待审批' },
  { status: 'APPROVED', label: '已审批' },
  { status: 'PURCHASING', label: '采购中' },
  { status: 'ARRIVED', label: '已到货', note: '瞬时态：到货即完成' },
  { status: 'COMPLETED', label: '已完成' },
];

export function stepperIndex(status: RequestStatus): number {
  if (status === 'COMPLETED') return STEPPER_STEPS.length; // 全部达成
  const i = STEPPER_STEPS.findIndex((s) => s.status === status);
  return i < 0 ? 0 : i;
}

/** 被驳回但状态仍为 PENDING —— 靠 rejectReason 区分 */
export function isRejected(request: Pick<PurchaseRequest, 'status' | 'rejectReason'>): boolean {
  return request.status === 'PENDING' && request.rejectReason.trim().length > 0;
}

export function statusText(request: Pick<PurchaseRequest, 'status' | 'rejectReason' | 'statusLabel'>): string {
  if (isRejected(request)) return '已驳回待重提';
  return request.statusLabel || requestStatusLabel(request.status);
}
