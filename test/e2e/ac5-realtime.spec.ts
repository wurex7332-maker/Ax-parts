import { INestApplication } from '@nestjs/common';
import { api, createTestApp } from './helper';

describe('AC-5 看板与报表实时性', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('库存变动后看板、流水、消耗排行、预警清单与采购统计同步更新', async () => {
    const initial = await api(app).get('/api/v1/dashboard').expect(200);
    expect(initial.body).toMatchObject({
      skuTotal: 6,
      alertCount: 2,
      stockoutCount: 1,
      pendingPurchaseCount: 1,
    });

    await api(app)
      .post('/api/v1/stock/inbound')
      .set('X-Actor', 'keeper')
      .send({ sku: 'PC-002', quantity: 5, source: 'PURCHASE' })
      .expect(201);
    const afterInbound = await api(app).get('/api/v1/dashboard').expect(200);
    expect(afterInbound.body).toMatchObject({ alertCount: 1, stockoutCount: 1 });

    const insufficient = await api(app)
      .post('/api/v1/stock/outbound')
      .send({ sku: 'PC-002', quantity: 7, recipient: '王五', purpose: '领用' })
      .expect(409);
    expect(insufficient.body.code).toBe('STOCK_INSUFFICIENT');

    await api(app)
      .post('/api/v1/stock/outbound')
      .send({ sku: 'PC-002', quantity: 6, recipient: '王五', purpose: '领用', batch: 'B-1' })
      .expect(201);
    const afterOutbound = await api(app).get('/api/v1/dashboard').expect(200);
    expect(afterOutbound.body).toMatchObject({ alertCount: 1, stockoutCount: 2 });
    expect(afterOutbound.body.healthDistribution.stockout.count).toBe(2);

    const movementsReport = await api(app).get('/api/v1/reports/movements?sku=PC-002').expect(200);
    expect(movementsReport.body.total).toBe(3); // 期初 1 + 入库 5 + 出库 6
    expect(movementsReport.body.items.map((item: { type: string }) => item.type)).toEqual([
      'IN_PURCHASE',
      'IN_PURCHASE',
      'OUT_ISSUE',
    ]);

    const rank = await api(app).get('/api/v1/reports/consumption-rank').expect(200);
    expect(rank.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sku: 'PC-002', consumedQty: 6, issueCount: 1 }),
      ]),
    );

    const alertsReport = await api(app).get('/api/v1/reports/alerts?level=STOCKOUT').expect(200);
    expect(alertsReport.body.items.map((item: { sku: string }) => item.sku).sort()).toEqual([
      'HDD-003',
      'PC-002',
    ]);

    const purchaseReport = await api(app).get('/api/v1/reports/purchase').expect(200);
    expect(purchaseReport.body).toMatchObject({
      openOrders: 1,
      totalOrderedQty: 20,
      arrivedQty: 0,
    });
    expect(purchaseReport.body.statusCounts.PURCHASING.count).toBe(1);
  });

  it('盘点、报损和调拨均生成流水且库存按流水汇总', async () => {
    const counted = await api(app)
      .post('/api/v1/stock/count')
      .set('X-Actor', 'keeper')
      .send({ sku: 'MON-004', location: 'A-03', actualQty: 6 })
      .expect(201);
    expect(counted.body).toMatchObject({ difference: -2, action: 'COUNT_LOSS', currentStock: 6 });

    const noDiff = await api(app)
      .post('/api/v1/stock/count')
      .send({ sku: 'MON-004', location: 'A-03', actualQty: 6 })
      .expect(201);
    expect(noDiff.body).toMatchObject({ difference: 0, action: null });
    expect(noDiff.body.movement).toBeNull();

    const gain = await api(app)
      .post('/api/v1/stock/count')
      .send({ sku: 'MON-004', location: 'A-03', actualQty: 9 })
      .expect(201);
    expect(gain.body).toMatchObject({ action: 'COUNT_GAIN', currentStock: 9 });

    const transferred = await api(app)
      .post('/api/v1/stock/adjust')
      .set('X-Actor', 'keeper')
      .send({
        sku: 'MON-004',
        type: 'TRANSFER',
        quantity: 2,
        sourceLocation: 'A-03',
        targetLocation: 'A-04',
      })
      .expect(201);
    expect(transferred.body.movements.map((item: { type: string }) => item.type)).toEqual([
      'TRANSFER_OUT',
      'TRANSFER_IN',
    ]);
    expect(transferred.body.currentStock).toBe(9);

    const loss = await api(app)
      .post('/api/v1/stock/adjust')
      .send({ sku: 'MON-004', type: 'LOSS', quantity: 1, location: 'A-03' })
      .expect(201);
    expect(loss.body.movements[0].type).toBe('ADJUST_LOSS');
    expect(loss.body.currentStock).toBe(8);

    const reversed = await api(app)
      .post(`/api/v1/stock/movements/${loss.body.movements[0].id}/reverse`)
      .set('X-Actor', 'auditor')
      .expect(201);
    expect(reversed.body.movement).toMatchObject({ type: 'REVERSAL', quantitySigned: 1 });
    expect(reversed.body.currentStock).toBe(9);

    const again = await api(app)
      .post(`/api/v1/stock/movements/${loss.body.movements[0].id}/reverse`)
      .expect(409);
    expect(again.body.code).toBe('ALREADY_REVERSED');
  });
});
