import type {
  AdjustType,
  Health,
  InboundSource,
  MovementType,
  NotificationType,
  RequestStatus,
  RequestSource,
} from './types';

/** 后端唯一允许的类别枚举（5 值） */
export const CATEGORIES = ['计算机设备', '计算机配件', '打印设备', '耗材', '网络设备'] as const;
/** 后端唯一允许的单位枚举（4 值） */
export const UNITS = ['台', '个', '盒', '箱'] as const;

export const INBOUND_SOURCES: { value: InboundSource; label: string }[] = [
  { value: 'PURCHASE', label: '采购入库' },
  { value: 'RETURN', label: '退料入库' },
];

export const ADJUST_TYPES: { value: AdjustType; label: string }[] = [
  { value: 'LOSS', label: '报损' },
  { value: 'TRANSFER', label: '调拨' },
];

export const MOVEMENT_TYPES: { value: MovementType; label: string }[] = [
  { value: 'IN_PURCHASE', label: '采购入库' },
  { value: 'IN_RETURN', label: '退料入库' },
  { value: 'OUT_ISSUE', label: '领用出库' },
  { value: 'COUNT_GAIN', label: '盘盈' },
  { value: 'COUNT_LOSS', label: '盘亏' },
  { value: 'ADJUST_LOSS', label: '报损' },
  { value: 'TRANSFER_OUT', label: '调拨出' },
  { value: 'TRANSFER_IN', label: '调拨入' },
  { value: 'REVERSAL', label: '冲正' },
];

export const REQUEST_STATUSES: { value: RequestStatus; label: string }[] = [
  { value: 'PENDING', label: '待审批' },
  { value: 'APPROVED', label: '已审批' },
  { value: 'PURCHASING', label: '采购中' },
  { value: 'ARRIVED', label: '已到货' },
  { value: 'COMPLETED', label: '已完成' },
];

export const HEALTH_LABEL: Record<Health, string> = {
  NORMAL: '正常',
  LOW: '预警',
  STOCKOUT: '断料',
};

export const NOTIFICATION_LABEL: Record<NotificationType, string> = {
  ALERT: '低库存预警',
  STOCKOUT: '断料提醒',
  APPROVED: '审批通过',
  REJECTED: '审批驳回',
  ARRIVED: '到货通知',
};

export const REQUEST_SOURCE_LABEL: Record<RequestSource, string> = {
  ALERT: '预警生成',
  MANUAL: '手工新建',
};

export function movementLabel(type: MovementType): string {
  return MOVEMENT_TYPES.find((m) => m.value === type)?.label ?? type;
}

export function requestStatusLabel(status: RequestStatus): string {
  return REQUEST_STATUSES.find((s) => s.value === status)?.label ?? status;
}
