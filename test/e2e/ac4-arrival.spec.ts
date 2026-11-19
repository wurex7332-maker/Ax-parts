import { INestApplication } from '@nestjs/common';
import { api, createTestApp } from './helper';

describe('AC-4 采购到货入库闭环', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('HDD-003 到货 20 → 库存 20、断料解除、申请完成、订单关闭', async () => {
    const orders = await api(app).get('/api/v1/purchase/orders').expect(200);
    const order = orders.body.items.find((item: { orderNo: string }) => item.orderNo === 'PO-SEED-0001');
    expect(order).toMatchObject({ status: 'OPEN', quantity: 20, sku: 'HDD-003' });

    const before = await api(app).get('/api/v1/dashboard').expect(200);
    expect(before.body.stockoutCount).toBe(1);

    const arrived = await api(app)
      .post(`/api/v1/purchase/orders/${order.id}/arrive`)
      .set('X-Actor', 'purchaser')
      .expect(201);
    expect(arrived.body).toMatchObject({
      currentStock: 20,
      previousHealth: 'STOCKOUT',
      health: 'NORMAL',
    });
    expect(arrived.body.request).toMatchObject({ status: 'COMPLETED', statusLabel: '已完成' });
    expect(arrived.body.order).toMatchObject({ status: 'CLOSED' });
    expect(arrived.body.movement).toMatchObject({
      type: 'IN_PURCHASE',
      quantitySigned: 20,
      operator: 'purchaser',
      relatedDocNo: 'PO-SEED-0001',
    });
    expect(arrived.body.movement.occurredAt).toBeDefined();

    const stock = await api(app).get('/api/v1/stock?sku=HDD-003').expect(200);
    expect(stock.body.items[0]).toMatchObject({ currentStock: 20, health: 'NORMAL' });

    const after = await api(app).get('/api/v1/dashboard').expect(200);
    expect(after.body).toMatchObject({ alertCount: 2, stockoutCount: 0, pendingPurchaseCount: 0 });

    const movements = await api(app)
      .get('/api/v1/stock/movements?sku=HDD-003&type=IN_PURCHASE')
      .expect(200);
    expect(movements.body.total).toBe(1);
    expect(movements.body.items[0].quantitySigned).toBe(20);

    const notifications = await api(app)
      .get('/api/v1/notifications?recipient=system')
      .expect(200);
    expect(notifications.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'ARRIVED' })]),
    );

    const duplicated = await api(app)
      .post(`/api/v1/purchase/orders/${order.id}/arrive`)
      .set('X-Actor', 'purchaser')
      .expect(409);
    expect(duplicated.body.code).toBe('ORDER_NOT_OPEN');
  });
});
