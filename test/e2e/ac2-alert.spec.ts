import { INestApplication } from '@nestjs/common';
import { api, createTestApp } from './helper';

describe('AC-2 预警与断料判定', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('PC-002/NET-006 预警，HDD-003 断料强提醒且不计入预警数', async () => {
    const alerts = await api(app).get('/api/v1/alerts').expect(200);
    const bySku = Object.fromEntries(alerts.body.items.map((item: { sku: string }) => [item.sku, item]));
    expect(bySku['PC-002']).toMatchObject({ level: 'LOW', currentStock: 1, safetyStock: 2 });
    expect(bySku['NET-006']).toMatchObject({ level: 'LOW', currentStock: 2, safetyStock: 2 });
    expect(bySku['HDD-003']).toMatchObject({
      level: 'STOCKOUT',
      levelLabel: '断料',
      currentStock: 0,
    });
    expect(alerts.body.total).toBe(3);

    const stockoutOnly = await api(app).get('/api/v1/alerts?level=STOCKOUT').expect(200);
    expect(stockoutOnly.body.items.map((item: { sku: string }) => item.sku)).toEqual(['HDD-003']);

    const dashboard = await api(app).get('/api/v1/dashboard').expect(200);
    expect(dashboard.body).toMatchObject({ alertCount: 2, stockoutCount: 1 });

    const rejected = await api(app)
      .post('/api/v1/stock/outbound')
      .send({ sku: 'HDD-003', quantity: 1, recipient: '李四', purpose: '领用' })
      .expect(409);
    expect(rejected.body.code).toBe('STOCK_INSUFFICIENT');

    const stock = await api(app).get('/api/v1/stock?sku=HDD-003').expect(200);
    expect(stock.body.items[0]).toMatchObject({ currentStock: 0, availableStock: 0, health: 'STOCKOUT' });
  });
});
