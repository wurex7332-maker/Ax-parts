import { INestApplication } from '@nestjs/common';
import { api, createTestApp, materialPayload } from './helper';

describe('AC-1 库存汇总与流水', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('新建辅料 → 入库 10 → 领用 3，库存 7 且流水恰两条', async () => {
    const created = await api(app)
      .post('/api/v1/materials')
      .send(materialPayload('TST-001'))
      .expect(201);
    expect(created.body.sku).toBe('TST-001');
    expect(created.body.currentStock).toBe(0);

    const inbound = await api(app)
      .post('/api/v1/stock/inbound')
      .set('X-Actor', 'keeper')
      .send({ sku: 'TST-001', quantity: 10, source: 'PURCHASE', purpose: '采购入库' })
      .expect(201);
    expect(inbound.body.currentStock).toBe(10);
    // 身份来自登录令牌；X-Actor 已失效，故意保留该请求头以验证不可伪造
    expect(inbound.body.movement.operator).toBe('supervisor');
    expect(inbound.body.movement.occurredAt).toBeDefined();

    const outbound = await api(app)
      .post('/api/v1/stock/outbound')
      .set('X-Actor', 'worker')
      .send({
        sku: 'TST-001',
        quantity: 3,
        recipient: '张三',
        purpose: '车间领用',
        batch: 'B-2026-01',
      })
      .expect(201);
    expect(outbound.body.currentStock).toBe(7);
    expect(outbound.body.availableStock).toBe(7);
    expect(outbound.body.movement.recipient).toBe('张三');
    expect(outbound.body.movement.operator).toBe('supervisor');

    const stock = await api(app).get('/api/v1/stock?sku=TST-001').expect(200);
    expect(stock.body.items).toHaveLength(1);
    expect(stock.body.items[0]).toMatchObject({
      sku: 'TST-001',
      currentStock: 7,
      availableStock: 7,
      lockedStock: 0,
      location: 'T-01',
    });

    const movements = await api(app)
      .get('/api/v1/stock/movements?sku=TST-001')
      .expect(200);
    expect(movements.body.total).toBe(2);
    expect(movements.body.items.map((item: { type: string }) => item.type)).toEqual([
      'IN_PURCHASE',
      'OUT_ISSUE',
    ]);
    expect(movements.body.items.every((item: { occurredAt: string }) => item.occurredAt)).toBe(true);

    const repeated = await api(app).get('/api/v1/stock?sku=TST-001').expect(200);
    expect(repeated.body.items[0].currentStock).toBe(7);
  });

  it('拒绝非法枚举与 unknown 字段（统一 400 VALIDATION_ERROR）', async () => {
    const invalid = await api(app)
      .post('/api/v1/materials')
      .send({ ...materialPayload('BAD-001'), category: '无效类别' })
      .expect(400);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');

    const duplicate = await api(app)
      .post('/api/v1/materials')
      .send(materialPayload('PRT-001'))
      .expect(409);
    expect(duplicate.body.code).toBe('DUPLICATE_SKU');
  });
});
