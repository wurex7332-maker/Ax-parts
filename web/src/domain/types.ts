/** 领域模型。字段命名严格对齐后端视图（camelCase）。 */

export type Health = 'NORMAL' | 'LOW' | 'STOCKOUT';
export type MaterialStatus = 'ENABLED' | 'DISABLED';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'PURCHASING' | 'ARRIVED' | 'COMPLETED';
export type OrderStatus = 'OPEN' | 'CLOSED';
export type MovementType =
  | 'IN_PURCHASE'
  | 'IN_RETURN'
  | 'OUT_ISSUE'
  | 'COUNT_GAIN'
  | 'COUNT_LOSS'
  | 'ADJUST_LOSS'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'REVERSAL';
export type NotificationType = 'ALERT' | 'STOCKOUT' | 'APPROVED' | 'REJECTED' | 'ARRIVED';
export type InboundSource = 'PURCHASE' | 'RETURN';
export type AdjustType = 'LOSS' | 'TRANSFER';
export type RequestSource = 'ALERT' | 'MANUAL';

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** /purchase/orders 与 /alerts/generate-suggestions 只返回 items+total */
export interface ItemsOnly<T> {
  items: T[];
  total: number;
}

export interface Material {
  sku: string;
  name: string;
  category: string;
  specModel: string;
  brand: string;
  unit: string;
  location: string;
  priceCents: number;
  safetyStock: number;
  supplier: string;
  imageUrl: string;
  status: MaterialStatus;
  createdAt: string;
  updatedAt: string;
}

/** GET /materials/{sku} 额外含 currentStock */
export interface MaterialDetail extends Material {
  currentStock: number;
}

export interface StockRow {
  sku: string;
  location: string;
  /** 库位级库存 */
  currentStock: number;
  lockedStock: number;
  availableStock: number;
  /** SKU 合计库存，健康态以此判定 */
  skuCurrentStock: number;
  safetyStock: number;
  health: Health;
}

export interface Movement {
  id: number;
  movementNo: string;
  sku: string;
  location: string;
  type: MovementType;
  quantitySigned: number;
  source: string;
  recipient: string;
  purpose: string;
  batch: string;
  operator: string;
  occurredAt: string;
  relatedDocNo: string;
  relatedMovementNo: string;
  createdAt: string;
}

export interface AlertItem {
  sku: string;
  name: string;
  category: string;
  unit: string;
  location: string;
  currentStock: number;
  lockedStock: number;
  availableStock: number;
  safetyStock: number;
  level: Health;
  levelLabel: string;
  suggestedQty: number;
}

export interface PurchaseSuggestion {
  sku: string;
  name: string;
  currentStock: number;
  safetyStock: number;
  level: Health;
  suggestedQty: number;
}

export interface PurchaseRequest {
  id: number;
  requestNo: string;
  sku: string;
  quantity: number;
  expectedDate: string;
  reason: string;
  status: RequestStatus;
  statusLabel: string;
  applicant: string;
  source: RequestSource;
  rejectReason: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: number;
  orderNo: string;
  requestNo: string;
  sku: string;
  quantity: number;
  status: OrderStatus;
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
}

export interface AppNotification {
  id: number;
  recipient: string;
  type: NotificationType;
  title: string;
  content: string;
  relatedDocNo: string;
  isRead: boolean;
  createdAt: string;
}

export interface Dashboard {
  skuTotal: number;
  alertCount: number;
  stockoutCount: number;
  pendingPurchaseCount: number;
  healthDistribution: {
    normal: { count: number; percentage: number };
    low: { count: number; percentage: number };
    stockout: { count: number; percentage: number };
  };
}

export interface ConsumptionRankItem {
  sku: string;
  name: string;
  unit: string;
  consumedQty: number;
  issueCount: number;
}

export interface PurchaseReport {
  statusCounts: Record<RequestStatus, { count: number; label: string }>;
  totalRequestedQty: number;
  totalOrderedQty: number;
  arrivedQty: number;
  openOrders: number;
}

export interface InboundResult {
  movement: Movement;
  currentStock: number;
  health: Health;
}

export interface OutboundResult {
  movement: Movement;
  currentStock: number;
  availableStock: number;
  health: Health;
}

export interface CountResult {
  sku: string;
  location: string;
  bookStock: number;
  actualQty: number;
  difference: number;
  action: 'COUNT_GAIN' | 'COUNT_LOSS' | null;
  movement: Movement | null;
  currentStock: number;
}

export interface AdjustResult {
  type: AdjustType;
  relatedDocNo: string;
  movements: Movement[];
  currentStock: number;
}

export interface ArriveResult {
  order: PurchaseOrder;
  request: PurchaseRequest;
  movement: Movement;
  currentStock: number;
  previousHealth: Health;
  health: Health;
}
