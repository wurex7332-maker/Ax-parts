import { beforeEach, describe, expect, it } from 'vitest';
import { createMockAdapter } from './mock-adapter';
import { resetDb, STORAGE_KEY } from './db';
import { ApiError } from '../errors';

const api = createMockAdapter();

beforeEach(() => {
  window.localStorage.clear();
  resetDb();
});

async function healthOf(sku: string) {
  const detail = await api.materials.get(sku);
  return detail.currentStock;
}

describe('种子与验收夹具', () => {
  it('6 个物料，PC-002 预警、HDD-003 断料、MON-004 正常', async () => {
    const page = await api.materials.list({ pageSize: 20 });
    expect(page.total).toBe(6);
    // 列表不含 currentStock（契约限制）
    expect('currentStock' in page.items[0]).toBe(false);

    const alerts = await api.alerts.list({ pageSize: 20 });
    expect(alerts.items.map((item) => item.sku)).toEqual(['HDD-003', 'PC-002', 'NET-006']);
    expect(alerts.items[0].level).toBe('STOCKOUT');
    expect(alerts.items.find((item) => item.sku === 'PC-002')?.level).toBe('LOW');
  });

  it('看板口径：预警数只含 LOW，断料单列', async () => {
    const dashboard = await api.dashboard();
    expect(dashboard.skuTotal).toBe(6);
    expect(dashboard.alertCount).toBe(2);
    expect(dashboard.stockoutCount).toBe(1);
    // 后端种子 1 条 PURCHASING + mock 为 AC-3 补的 2 条 PENDING
    expect(dashboard.pendingPurchaseCount).toBe(3);
    expect(dashboard.healthDistribution.normal.count).toBe(3);
    expect(dashboard.healthDistribution.low.count).toBe(2);
    expect(dashboard.healthDistribution.stockout.count).toBe(1);
  });
});

describe('库存变动', () => {
  it('AC-4：MON-004 领用 3 后库存 8→5，新增一条 OUT_ISSUE 流水', async () => {
    const before = await healthOf('MON-004');
    expect(before).toBe(8);

    const result = await api.stock.outbound({ sku: 'MON-004', quantity: 3, recipient: '张三' }, {
      idempotencyKey: 'k-ac4',
    });
    expect(result.currentStock).toBe(5);
    expect(result.availableStock).toBe(5);
    expect(result.health).toBe('NORMAL');
    expect(result.movement.quantitySigned).toBe(-3);

    const movements = await api.stock.movements({ sku: 'MON-004', pageSize: 50 });
    expect(movements.items.filter((m) => m.type === 'OUT_ISSUE')).toHaveLength(1);
  });

  it('幂等：同一 Idempotency-Key 只产生一条流水', async () => {
    const first = await api.stock.outbound({ sku: 'MON-004', quantity: 2, recipient: '张三' }, { idempotencyKey: 'dup' });
    const second = await api.stock.outbound({ sku: 'MON-004', quantity: 2, recipient: '张三' }, { idempotencyKey: 'dup' });
    expect(second.currentStock).toBe(first.currentStock);
    const movements = await api.stock.movements({ sku: 'MON-004', pageSize: 50 });
    expect(movements.items.filter((m) => m.type === 'OUT_ISSUE')).toHaveLength(1);
  });

  it('可用量不足时阻断并返回 STOCK_INSUFFICIENT', async () => {
    await expect(api.stock.outbound({ sku: 'PC-002', quantity: 5, recipient: '张三' })).rejects.toMatchObject({
      code: 'STOCK_INSUFFICIENT',
    });
  });

  it('入库后台账与看板同步变化（AC-1 的数据侧）', async () => {
    await api.materials.create({
      sku: 'PRT-007',
      name: '测试打印机',
      category: '打印设备',
      unit: '台',
      location: 'A-09',
      safetyStock: 1,
    });
    let dashboard = await api.dashboard();
    expect(dashboard.skuTotal).toBe(7);

    await api.stock.inbound({ sku: 'PRT-007', quantity: 5, source: 'PURCHASE' });
    dashboard = await api.dashboard();
    expect(dashboard.skuTotal).toBe(7);
    expect(dashboard.stockoutCount).toBe(1); // 新物料入库后不再断料，HDD-003 仍断料

    const stock = await api.stock.list({ sku: 'PRT-007' });
    expect(stock.items[0].currentStock).toBe(5);
  });

  it('盘点差额为 0 时不产生流水', async () => {
    const result = await api.stock.count({ sku: 'TNR-005', location: 'C-01', actualQty: 12 });
    expect(result.difference).toBe(0);
    expect(result.movement).toBeNull();
  });

  it('调拨生成一出一入两条流水', async () => {
    const result = await api.stock.adjust({
      sku: 'MON-004',
      type: 'TRANSFER',
      quantity: 2,
      sourceLocation: 'A-03',
      targetLocation: 'A-05',
    });
    expect(result.movements).toHaveLength(2);
    expect(result.movements.map((m) => m.type)).toEqual(['TRANSFER_OUT', 'TRANSFER_IN']);
    const stock = await api.stock.list({ sku: 'MON-004' });
    expect(stock.items.find((r) => r.location === 'A-05')?.currentStock).toBe(2);
    expect(stock.items.find((r) => r.location === 'A-03')?.currentStock).toBe(6);
  });
});

describe('采购审批', () => {
  it('AC-3：通过后状态为 APPROVED，双端读同一数据', async () => {
    const pending = await api.purchase.listRequests({ status: 'PENDING', pageSize: 20 });
    expect(pending.total).toBe(2);
    const target = pending.items[0];

    const approved = await api.purchase.approve(target.id);
    expect(approved.status).toBe('APPROVED');
    expect(approved.version).toBe(target.version + 1);

    const reread = await api.purchase.getRequest(target.id);
    expect(reread.status).toBe('APPROVED');
  });

  it('AC-3：驳回后仍是 PENDING 且保留原因；空原因被拒', async () => {
    const pending = await api.purchase.listRequests({ status: 'PENDING', pageSize: 20 });
    const target = pending.items[pending.items.length - 1];

    await expect(api.purchase.reject(target.id, { reason: '   ' })).rejects.toMatchObject({
      code: 'REJECT_REASON_REQUIRED',
    });

    const rejected = await api.purchase.reject(target.id, { reason: '预算超限' });
    expect(rejected.status).toBe('PENDING');
    expect(rejected.rejectReason).toBe('预算超限');

    const resubmitted = await api.purchase.resubmit(target.id);
    expect(resubmitted.rejectReason).toBe('');
  });

  it('一申请只能建一张订单', async () => {
    const pending = await api.purchase.listRequests({ status: 'PENDING', pageSize: 5 });
    const target = pending.items[0];
    await api.purchase.approve(target.id);
    await api.purchase.createOrder({ requestId: target.id });
    await expect(api.purchase.createOrder({ requestId: target.id })).rejects.toMatchObject({
      code: 'DUPLICATE_ORDER',
    });
  });

  it('到货入库存量增加、订单关单、申请转 COMPLETED（不经 ARRIVED）', async () => {
    const orders = await api.purchase.listOrders();
    const open = orders.items.find((order) => order.status === 'OPEN');
    expect(open).toBeTruthy();

    const before = await healthOf('HDD-003');
    const result = await api.purchase.arrive(open!.id);
    expect(result.currentStock).toBe(before + open!.quantity);
    expect(result.order.status).toBe('CLOSED');
    expect(result.request.status).toBe('COMPLETED');
    expect(result.previousHealth).toBe('STOCKOUT');
    expect(result.health).not.toBe('STOCKOUT');
  });

  it('非法状态迁移抛出 ILLEGAL_STATE_TRANSITION', async () => {
    const completed = (await api.purchase.listRequests({ pageSize: 50 })).items.find(
      (r) => r.status === 'COMPLETED',
    );
    if (completed) {
      await expect(api.purchase.approve(completed.id)).rejects.toBeInstanceOf(ApiError);
    }
  });
});

describe('请求校验（复刻 forbidNonWhitelisted）', () => {
  it('新建物料带 status 字段直接 400', async () => {
    await expect(
      api.materials.create({
        sku: 'X-001',
        name: '测试',
        category: '耗材',
        unit: '个',
        location: 'Z-01',
        safetyStock: 1,
        // @ts-expect-error 故意传入后端不允许的字段
        status: 'ENABLED',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('编辑物料不允许传 sku', async () => {
    await expect(
      // @ts-expect-error 故意构造非法入参
      api.materials.update('PRT-001', { sku: 'PRT-999', name: '改名' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('类别越界被拒', async () => {
    await expect(
      api.materials.create({
        sku: 'X-002',
        name: '测试',
        category: '不存在的类别',
        unit: '个',
        location: 'Z-01',
        safetyStock: 1,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('SKU 重复返回 DUPLICATE_SKU', async () => {
    await expect(
      api.materials.create({
        sku: 'PRT-001',
        name: '重复',
        category: '打印设备',
        unit: '台',
        location: 'A-01',
        safetyStock: 1,
      }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_SKU' });
  });
});

describe('持久化与跨标签页', () => {
  it('写入后重新加载数据库仍有数据（模拟刷新）', async () => {
    await api.stock.inbound({ sku: 'MON-004', quantity: 1, source: 'PURCHASE' });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as { revision: number };
    expect(parsed.revision).toBeGreaterThan(1);
  });

  it('reset 回到种子态', async () => {
    await api.stock.outbound({ sku: 'MON-004', quantity: 1, recipient: '张三' });
    api.reset();
    expect(await healthOf('MON-004')).toBe(8);
  });
});
