import { INestApplication } from '@nestjs/common';
import { api, createTestApp } from './helper';

describe('AC-3 采购审批状态机（含驳回回退）', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('建议生成 → 驳回 → 重提 → 通过 → 建单，非法迁移被拒绝', async () => {
    const suggestions = await api(app)
      .post('/api/v1/alerts/generate-suggestions')
      .expect(201);
    const pc = suggestions.body.items.find((item: { sku: string }) => item.sku === 'PC-002');
    expect(pc).toMatchObject({ suggestedQty: 3, level: 'LOW' });
    expect(suggestions.body.items.find((item: { sku: string }) => item.sku === 'HDD-003')).toMatchObject({
      suggestedQty: 10,
      level: 'STOCKOUT',
    });

    const created = await api(app)
      .post('/api/v1/purchase/requests')
      .send({
        sku: 'PC-002',
        quantity: pc.suggestedQty,
        expectedDate: '2026-12-31',
        reason: '低库存预警补货',
        source: 'ALERT',
        applicant: 'alice',
      })
      .expect(201);
    const id = created.body.id;
    expect(created.body).toMatchObject({ status: 'PENDING', statusLabel: '待审批', applicant: 'alice' });

    const illegalOrder = await api(app)
      .post('/api/v1/purchase/orders')
      .set('X-Actor', 'purchaser')
      .send({ requestId: id })
      .expect(409);
    expect(illegalOrder.body.code).toBe('ILLEGAL_STATE_TRANSITION');

    const missingReason = await api(app)
      .post(`/api/v1/purchase/requests/${id}/reject`)
      .set('X-Actor', 'supervisor')
      .send({ reason: '' })
      .expect(400);
    expect(missingReason.body.code).toBe('VALIDATION_ERROR');

    const rejected = await api(app)
      .post(`/api/v1/purchase/requests/${id}/reject`)
      .set('X-Actor', 'supervisor')
      .send({ reason: '预算未落实' })
      .expect(201);
    expect(rejected.body).toMatchObject({ status: 'PENDING', rejectReason: '预算未落实' });

    const rejectedMessages = await api(app)
      .get('/api/v1/notifications?recipient=alice')
      .expect(200);
    expect(rejectedMessages.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'REJECTED' })]),
    );

    const resubmitted = await api(app)
      .post(`/api/v1/purchase/requests/${id}/resubmit`)
      .expect(201);
    expect(resubmitted.body).toMatchObject({ status: 'PENDING', rejectReason: '' });

    const approved = await api(app)
      .post(`/api/v1/purchase/requests/${id}/approve`)
      .set('X-Actor', 'supervisor')
      .expect(201);
    expect(approved.body).toMatchObject({ status: 'APPROVED', statusLabel: '已审批' });

    const approvedMessages = await api(app).get('/api/v1/notifications?recipient=alice').expect(200);
    expect(approvedMessages.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'APPROVED' })]),
    );

    const order = await api(app)
      .post('/api/v1/purchase/orders')
      .set('X-Actor', 'purchaser')
      .send({ requestId: id })
      .expect(201);
    expect(order.body).toMatchObject({ status: 'OPEN', sku: 'PC-002', quantity: 3 });

    const purchasing = await api(app).get(`/api/v1/purchase/requests?status=PURCHASING`).expect(200);
    expect(purchasing.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id, status: 'PURCHASING' })]),
    );

    const reapprove = await api(app)
      .post(`/api/v1/purchase/requests/${id}/approve`)
      .set('X-Actor', 'supervisor')
      .expect(409);
    expect(reapprove.body.code).toBe('ILLEGAL_STATE_TRANSITION');
  });
});
