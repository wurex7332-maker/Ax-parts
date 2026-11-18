import { INestApplication } from '@nestjs/common';
import { StockService } from '../../src/modules/stock/stock.service';
import { api, createTestApp } from './helper';

describe('锁定库存（A3）', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('锁定/解锁后可用库存按当前库存减锁定量计算，出库校验使用可用库存', async () => {
    const stock = app.get(StockService);
    expect(stock.lockStock('PC-002', 1, 'ORDER-X')).toMatchObject({
      currentStock: 1,
      lockedStock: 1,
      availableStock: 0,
    });

    const list = await api(app).get('/api/v1/stock?sku=PC-002').expect(200);
    expect(list.body.items[0]).toMatchObject({ lockedStock: 1, availableStock: 0 });

    const rejected = await api(app)
      .post('/api/v1/stock/outbound')
      .send({ sku: 'PC-002', quantity: 1, recipient: '测试', purpose: '领用' })
      .expect(409);
    expect(rejected.body.code).toBe('STOCK_INSUFFICIENT');

    expect(stock.unlockStock('PC-002', 'ORDER-X')).toMatchObject({
      lockedStock: 0,
      availableStock: 1,
    });
    await api(app)
      .post('/api/v1/stock/outbound')
      .send({ sku: 'PC-002', quantity: 1, recipient: '测试', purpose: '领用' })
      .expect(201);
  });
});
