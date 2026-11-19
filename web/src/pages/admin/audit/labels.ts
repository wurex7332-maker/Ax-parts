import type { AuditAction } from '../../../domain/types';

export const AUDIT_ACTION_LABEL: Record<AuditAction | string, string> = {
  AUTH_LOGIN: '登录',
  MATERIAL_CREATE: '新增辅料',
  MATERIAL_UPDATE: '编辑辅料',
  MATERIAL_DISABLE: '停用辅料',
  STOCK_INBOUND: '入库',
  STOCK_OUTBOUND: '领用出库',
  STOCK_COUNT: '盘点',
  STOCK_ADJUST: '库存调整',
  PURCHASE_CREATE: '新建采购申请',
  PURCHASE_APPROVE: '审批通过',
  PURCHASE_REJECT: '审批驳回',
  PURCHASE_RESUBMIT: '重新提交',
  PURCHASE_ORDER_CREATE: '生成采购订单',
  PURCHASE_ARRIVE: '到货入库',
  USER_CREATE: '新增用户',
  USER_UPDATE: '修改用户',
  USER_RESET_PASSWORD: '重置密码',
  DICTIONARY_CREATE: '新增字典项',
  DICTIONARY_UPDATE: '修改字典项',
};
