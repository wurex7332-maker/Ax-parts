import type {
  AppNotification,
  DictionaryItem,
  Material,
  Movement,
  PurchaseOrder,
  PurchaseRequest,
} from '../../domain/types';
import { suggestedQtyOf } from '../../domain/health';
import type { MockDb, MockUser, StockCell } from './db';

/** 固定基准时间，保证种子与测试确定性 */
const T0 = '2026-11-18T09:00:00+08:00';

interface SeedMaterial {
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
  qty: number;
}

const SEED_MATERIALS: SeedMaterial[] = [
  {
    sku: 'PRT-001',
    name: '激光打印机',
    category: '打印设备',
    specModel: 'LJ-100',
    brand: 'HP',
    unit: '台',
    location: 'A-01',
    priceCents: 189900,
    safetyStock: 2,
    supplier: '办公设备供应商',
    qty: 3,
  },
  {
    sku: 'PC-002',
    name: '办公台式机',
    category: '计算机设备',
    specModel: 'T5',
    brand: 'Lenovo',
    unit: '台',
    location: 'A-02',
    priceCents: 459900,
    safetyStock: 2,
    supplier: '电脑城',
    qty: 1,
  },
  {
    sku: 'HDD-003',
    name: '1TB 机械硬盘',
    category: '计算机配件',
    specModel: 'ST1000',
    brand: 'Seagate',
    unit: '个',
    location: 'B-01',
    priceCents: 29900,
    safetyStock: 5,
    supplier: '存储配件商',
    qty: 0,
  },
  {
    sku: 'MON-004',
    name: '24 寸显示器',
    category: '计算机设备',
    specModel: 'E24',
    brand: 'Dell',
    unit: '台',
    location: 'A-03',
    priceCents: 89900,
    safetyStock: 3,
    supplier: '办公设备供应商',
    qty: 8,
  },
  {
    sku: 'TNR-005',
    name: '硒鼓',
    category: '耗材',
    specModel: '88A',
    brand: 'Canon',
    unit: '盒',
    location: 'C-01',
    priceCents: 19900,
    safetyStock: 10,
    supplier: '耗材专营',
    qty: 12,
  },
  {
    sku: 'NET-006',
    name: '千兆交换机',
    category: '网络设备',
    specModel: 'SG108',
    brand: 'TP-LINK',
    unit: '台',
    location: 'B-02',
    priceCents: 129000,
    safetyStock: 2,
    supplier: '网络集成商',
    qty: 2,
  },
];

const SEED_USERS: { username: string; displayName: string; role: MockUser['role'] }[] = [
  { username: 'warehouse', displayName: '库管员', role: 'warehouse' },
  { username: 'supervisor', displayName: '车间主管', role: 'supervisor' },
  { username: 'purchaser', displayName: '采购员', role: 'buyer' },
  { username: 'operator', displayName: '领用人员', role: 'operator' },
];

const SEED_DICTIONARIES: { type: 'CATEGORY' | 'UNIT'; value: string }[] = [
  { type: 'CATEGORY', value: '计算机设备' },
  { type: 'CATEGORY', value: '计算机配件' },
  { type: 'CATEGORY', value: '打印设备' },
  { type: 'CATEGORY', value: '耗材' },
  { type: 'CATEGORY', value: '网络设备' },
  { type: 'UNIT', value: '台' },
  { type: 'UNIT', value: '个' },
  { type: 'UNIT', value: '盒' },
  { type: 'UNIT', value: '箱' },
];

export function createSeedDb(): MockDb {
  const materials: Material[] = SEED_MATERIALS.map((m) => ({
    sku: m.sku,
    name: m.name,
    category: m.category,
    specModel: m.specModel,
    brand: m.brand,
    unit: m.unit,
    location: m.location,
    priceCents: m.priceCents,
    safetyStock: m.safetyStock,
    supplier: m.supplier,
    imageUrl: '',
    status: 'ENABLED',
    createdAt: T0,
    updatedAt: T0,
  }));

  const cells: StockCell[] = SEED_MATERIALS.map((m) => ({
    sku: m.sku,
    location: m.location,
    qty: m.qty,
    locked: 0,
  }));

  // 期初流水：qty 为 0 的物料不写流水（与后端种子一致）
  const movements: Movement[] = SEED_MATERIALS.filter((m) => m.qty > 0).map((m, index) => ({
    id: index + 1,
    movementNo: `MVT-SEED-${String(index + 1).padStart(4, '0')}`,
    sku: m.sku,
    location: m.location,
    type: 'IN_PURCHASE' as const,
    quantitySigned: m.qty,
    source: 'INITIAL',
    recipient: '',
    purpose: '期初库存',
    batch: '',
    operator: 'system',
    occurredAt: T0,
    relatedDocNo: '',
    relatedMovementNo: '',
    createdAt: T0,
  }));

  const requests: PurchaseRequest[] = [
    {
      id: 1,
      requestNo: 'PR-SEED-0001',
      sku: 'HDD-003',
      quantity: 20,
      expectedDate: '2026-12-31',
      reason: '断料预警，需采购补货',
      status: 'PURCHASING',
      statusLabel: '采购中',
      applicant: 'system',
      source: 'ALERT',
      rejectReason: '',
      version: 2,
      createdAt: T0,
      updatedAt: T0,
    },
    // 以下两条为满足 AC-3「待审批样本」而补充（后端种子无待审批单，见 DIVERGENCE.md）
    {
      id: 2,
      requestNo: 'PR-SEED-0002',
      sku: 'PC-002',
      quantity: 4,
      expectedDate: '2026-11-30',
      reason: '库存预警补货：办公台式机(PC-002) 当前 1，安全库存 2',
      status: 'PENDING',
      statusLabel: '待审批',
      applicant: 'warehouse',
      source: 'ALERT',
      rejectReason: '',
      version: 1,
      createdAt: T0,
      updatedAt: T0,
    },
    {
      id: 3,
      requestNo: 'PR-SEED-0003',
      sku: 'NET-006',
      quantity: 3,
      expectedDate: '2026-11-30',
      reason: '库存预警补货：千兆交换机(NET-006) 当前 2，安全库存 2',
      status: 'PENDING',
      statusLabel: '待审批',
      applicant: 'warehouse',
      source: 'ALERT',
      rejectReason: '',
      version: 1,
      createdAt: T0,
      updatedAt: T0,
    },
  ];

  const orders: PurchaseOrder[] = [
    {
      id: 1,
      orderNo: 'PO-SEED-0001',
      requestNo: 'PR-SEED-0001',
      sku: 'HDD-003',
      quantity: 20,
      status: 'OPEN',
      createdBy: 'purchaser',
      createdAt: T0,
      closedAt: null,
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 1,
      recipient: 'warehouse',
      type: 'STOCKOUT',
      title: '断料强提醒：HDD-003',
      content: '1TB 机械硬盘 当前库存 0，安全库存 5，需立即补货。',
      relatedDocNo: 'PR-SEED-0001',
      isRead: false,
      createdAt: T0,
    },
    {
      id: 2,
      recipient: 'warehouse',
      type: 'ALERT',
      title: '低库存预警：PC-002',
      content: '办公台式机 当前库存 1，安全库存 2。',
      relatedDocNo: 'PC-002',
      isRead: false,
      createdAt: T0,
    },
    {
      id: 3,
      recipient: 'warehouse',
      type: 'ALERT',
      title: '低库存预警：NET-006',
      content: '千兆交换机 当前库存 2，安全库存 2。',
      relatedDocNo: 'NET-006',
      isRead: false,
      createdAt: T0,
    },
    {
      id: 4,
      recipient: 'supervisor',
      type: 'ALERT',
      title: '待审批：PR-SEED-0002',
      content: '库管员提交采购申请，等待车间主管审批。',
      relatedDocNo: 'PR-SEED-0002',
      isRead: false,
      createdAt: T0,
    },
  ];

  const users: MockUser[] = SEED_USERS.map((user, index) => ({
    id: index + 1,
    username: user.username,
    passwordHash: 'mock:axparts123',
    displayName: user.displayName,
    role: user.role,
    status: 'ENABLED',
    createdAt: T0,
    updatedAt: T0,
    lastLoginAt: '',
  }));

  const dictionaries: DictionaryItem[] = SEED_DICTIONARIES.map((item, index) => ({
    id: index + 1,
    type: item.type,
    value: item.value,
    label: item.value,
    sortOrder: index + 1,
    enabled: true,
    createdAt: T0,
    updatedAt: T0,
  }));

  return {
    schemaVersion: 1,
    revision: 1,
    users,
    auditLogs: [],
    dictionaries,
    materials,
    cells,
    movements,
    requests,
    orders,
    notifications,
    idempotency: {},
    seq: {
      movement: movements.length,
      order: orders.length,
      notification: notifications.length,
      request: requests.length,
      user: users.length,
      audit: 0,
    },
    createdAt: T0,
  };
}

/** 供测试与 DIVERGENCE 校验使用 */
export const SEED_SPEC = SEED_MATERIALS.map((m) => ({
  sku: m.sku,
  qty: m.qty,
  safetyStock: m.safetyStock,
  suggestedQty: suggestedQtyOf(m.qty, m.safetyStock),
}));
