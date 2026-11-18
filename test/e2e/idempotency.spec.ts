import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../src/infra/database.module';
import { api, createTestApp, materialPayload } from './helper';

describe('幂等与流水不可变', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('相同 Idempotency-Key 重复扫码出库只记一条流水并回放首次结果', async () => {
    await api(app).post('/api/v1/materials').send(materialPayload('TST-002')).expect(201);
    await api(app)
      .post('/api/v1/stock/inbound')
      .send({ sku: 'TST-002', quantity: 5, source: 'PURCHASE' })
      .expect(201);

    const payload = {
      sku: 'TST-002',
      quantity: 2,
      recipient: '赵六',
      purpose: '扫码领用',
      batch: 'B-9',
    };
    const first = await api(app)
      .post('/api/v1/stock/outbound')
      .set('Idempotency-Key', 'scan-abc')
      .send(payload)
      .expect(201);
    const second = await api(app)
      .post('/api/v1/stock/outbound')
      .set('Idempotency-Key', 'scan-abc')
      .send(payload)
      .expect(201);

    expect(second.body).toEqual(first.body);
    const movements = await api(app).get('/api/v1/stock/movements?sku=TST-002').expect(200);
    expect(movements.body.total).toBe(2);
    const stock = await api(app).get('/api/v1/stock?sku=TST-002').expect(200);
    expect(stock.body.items[0].currentStock).toBe(3);
  });

  it('数据库触发器禁止物理删除或修改流水，且无删除端点', async () => {
    const result = await api(app).get('/api/v1/stock/movements').expect(200);
    expect(result.body.total).toBeGreaterThan(0);
    const dbService = app.get(DatabaseService);
    expect(() =>
      dbService.db.prepare('DELETE FROM stock_movements WHERE id = 1').run(),
    ).toThrow(/append-only/);
    expect(() =>
      dbService.db.prepare('UPDATE stock_movements SET quantity_signed = 99 WHERE id = 1').run(),
    ).toThrow(/append-only/);
    await api(app).delete('/api/v1/stock/movements/1').expect(404);
  });
});
