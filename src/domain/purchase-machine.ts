export type PurchaseStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PURCHASING'
  | 'ARRIVED'
  | 'COMPLETED';

export type PurchaseAction =
  | 'APPROVE'
  | 'REJECT'
  | 'RESUBMIT'
  | 'CREATE_ORDER'
  | 'ARRIVE'
  | 'CLOSE';

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  PENDING: '待审批',
  APPROVED: '已审批',
  PURCHASING: '采购中',
  ARRIVED: '已到货',
  COMPLETED: '已完成',
};

interface Transition {
  next: PurchaseStatus;
  /** 事务内瞬时态：arrive 从 PURCHASING 经 ARRIVED 到 COMPLETED。 */
  via?: PurchaseStatus;
  requiresReason?: boolean;
}

const TABLE: Record<PurchaseStatus, Partial<Record<PurchaseAction, Transition>>> = {
  PENDING: {
    APPROVE: { next: 'APPROVED' },
    REJECT: { next: 'PENDING', requiresReason: true },
    RESUBMIT: { next: 'PENDING' },
  },
  APPROVED: {
    CREATE_ORDER: { next: 'PURCHASING' },
  },
  PURCHASING: {
    ARRIVE: { next: 'COMPLETED', via: 'ARRIVED' },
  },
  ARRIVED: {
    CLOSE: { next: 'COMPLETED' },
  },
  COMPLETED: {},
};

export function canTransition(status: PurchaseStatus, action: PurchaseAction): boolean {
  return Boolean(TABLE[status]?.[action]);
}

/**
 * 返回迁移结果；非法迁移或驳回缺少原因时抛错，调用方在事务内使用以保证无副作用。
 */
export function applyTransition(
  status: PurchaseStatus,
  action: PurchaseAction,
  options: { rejectReason?: string } = {},
): Transition {
  const transition = TABLE[status]?.[action];
  if (!transition) {
    throw new Error(`ILLEGAL_STATE_TRANSITION: ${status} - ${action}`);
  }
  if (transition.requiresReason && !options.rejectReason?.trim()) {
    throw new Error('REJECT_REASON_REQUIRED');
  }
  return transition;
}
