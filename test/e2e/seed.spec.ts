import { INestApplication } from '@nestjs/common';
import { api, createTestApp } from './helper';

describe('种子数据（F1/F2/F3/F5）', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('6 个 SKU 的期初库存由流水汇总，健康分桶与看板初值符合需求', async () => {
    const dashboard = await api(app).get('/api/v1/dashboard').expect(200);
    expect(dashboard.body).toMatchObject({
      skuTotal: 6,
      alertCount: 2,
      stockoutCount: 1,
      pendingPurchaseCount: 1,
    });
    expect(dashboard.body.healthDistribution).toMatchObject({
      normal: { count: 3, percentage: 0.5 },
      low: { count: 2, percentage: 0.3333 },
      stockout: { count: 1, percentage: 0.1667 },
    });

    const materials = await api(app).get('/api/v1/materials').expect(200);
    expect(materials.body.total).toBe(6);

    const expected: Record<string, number> = {
      'PRT-001': 3,
      'PC-002': 1,
      'HDD-003': 0,
      'MON-004': 8,
      'TNR-005': 12,
      'NET-006': 2,
    };
    for (const [sku, stock] of Object.entries(expected)) {
      const detail = await api(app).get(`/api/v1/materials/${sku}`).expect(200);
      expect(detail.body.currentStock).toBe(stock);
    }

    // HDD-003 期初库存为 0，不写 0 数量流水。
    const movements = await api(app).get('/api/v1/stock/movements?sku=HDD-003').expect(200);
    expect(movements.body.total).toBe(0);

    const alerts = await api(app).get('/api/v1/alerts').expect(200);
    expect(alerts.body.items.map((item: { sku: string }) => item.sku).sort()).toEqual([
      'HDD-003',
      'NET-006',
      'PC-002',
    ]);
  });

  it('预置采购中申请、OPEN 订单与断料站内消息可查询', async () => {
    const orders = await api(app).get('/api/v1/purchase/orders').expect(200);
    expect(orders.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ orderNo: 'PO-SEED-0001', status: 'OPEN', quantity: 20 }),
      ]),
    );

    const requests = await api(app).get('/api/v1/purchase/requests').expect(200);
    expect(requests.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sku: 'HDD-003', status: 'PURCHASING', quantity: 20 }),
      ]),
    );

    const notifications = await api(app)
      .get('/api/v1/notifications?recipient=warehouse')
      .expect(200);
    expect(notifications.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'STOCKOUT', title: '断料强提醒：HDD-003' }),
      ]),
    );
  });
});
