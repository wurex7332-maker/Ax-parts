import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAs, materialPayload } from './helper';

describe('登录与后台管理', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const anonymous = () => request(app.getHttpServer());

  it('未登录访问业务接口返回 401', async () => {
    const res = await anonymous().get('/api/v1/materials').expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('健康检查保持公开', async () => {
    await anonymous().get('/health').expect(200);
  });

  it('密码错误返回 401，且不暴露账号是否存在', async () => {
    const wrong = await anonymous()
      .post('/api/v1/auth/login')
      .send({ username: 'supervisor', password: 'wrong-password' })
      .expect(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');

    const unknown = await anonymous()
      .post('/api/v1/auth/login')
      .send({ username: 'nobody', password: 'whatever' })
      .expect(401);
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('登录成功返回令牌与用户信息，令牌可用于访问业务接口', async () => {
    const res = await anonymous()
      .post('/api/v1/auth/login')
      .send({ username: 'warehouse', password: 'axparts123' })
      .expect(200);
    expect(res.body.user).toMatchObject({ username: 'warehouse', role: 'warehouse' });
    expect(typeof res.body.token).toBe('string');

    await request(app.getHttpServer())
      .get('/api/v1/materials')
      .set('Authorization', `Bearer ${res.body.token}`)
      .expect(200);
  });

  it('伪造 X-Actor 不影响流水操作人（身份取自令牌）', async () => {
    const token = await loginAs(app, 'warehouse');
    const created = await request(app.getHttpServer())
      .post('/api/v1/materials')
      .set('Authorization', `Bearer ${token}`)
      .send(materialPayload('FORGE-001', 1))
      .expect(201);
    expect(created.body.sku).toBe('FORGE-001');

    const inbound = await request(app.getHttpServer())
      .post('/api/v1/stock/inbound')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Actor', 'hacker')
      .send({ sku: 'FORGE-001', quantity: 5, source: 'PURCHASE' })
      .expect(201);
    expect(inbound.body.movement.operator).toBe('warehouse');
  });

  it('非主管角色访问用户管理返回 403', async () => {
    const token = await loginAs(app, 'warehouse');
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('主管可查看用户列表，且种子包含 4 个角色', async () => {
    const token = await loginAs(app, 'supervisor');
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items.map((u: { role: string }) => u.role).sort()).toEqual([
      'buyer',
      'operator',
      'supervisor',
      'warehouse',
    ]);
    // 不得下发密码哈希
    expect(JSON.stringify(res.body)).not.toContain('scrypt');
  });

  it('新增用户、重复用户名冲突、停用后无法登录', async () => {
    const token = await loginAs(app, 'supervisor');
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newkeeper', displayName: '新库管', password: 'secret123', role: 'warehouse' })
      .expect(201);
    expect(created.body.username).toBe('newkeeper');

    const dup = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newkeeper', displayName: '重复', password: 'secret123', role: 'warehouse' })
      .expect(409);
    expect(dup.body.code).toBe('DUPLICATE_USER');

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'newkeeper', password: 'secret123' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DISABLED' })
      .expect(200);

    const blocked = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'newkeeper', password: 'secret123' })
      .expect(409);
    expect(blocked.body.code).toBe('USER_DISABLED');
  });

  it('不允许停用最后一名主管', async () => {
    const token = await loginAs(app, 'supervisor');
    const users = await request(app.getHttpServer())
      .get('/api/v1/users?role=supervisor')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const me = users.body.items[0];

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/users/${me.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DISABLED' })
      .expect(400);
    expect(res.body.message).toContain('至少需要保留一名');
  });

  it('数据字典：可新增类别并用于建档；被引用的字典项不能停用', async () => {
    const token = await loginAs(app, 'supervisor');

    const created = await request(app.getHttpServer())
      .post('/api/v1/dictionaries')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'CATEGORY', value: '劳保用品', label: '劳保用品', sortOrder: 9 })
      .expect(201);
    expect(created.body).toMatchObject({ type: 'CATEGORY', value: '劳保用品', enabled: true });

    const payload = { ...materialPayload('PPE-001', 1), category: '劳保用品' };
    await request(app.getHttpServer())
      .post('/api/v1/materials')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    const inUse = await request(app.getHttpServer())
      .patch(`/api/v1/dictionaries/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false })
      .expect(409);
    expect(inUse.body.code).toBe('DICTIONARY_IN_USE');
  });

  it('未在字典中的类别建档被拒绝', async () => {
    const token = await loginAs(app, 'supervisor');
    const res = await request(app.getHttpServer())
      .post('/api/v1/materials')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...materialPayload('BAD-001', 1), category: '不存在的类别' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('审计日志记录了操作人与动作，且仅主管可见', async () => {
    const token = await loginAs(app, 'supervisor');
    await request(app.getHttpServer())
      .post('/api/v1/materials')
      .set('Authorization', `Bearer ${token}`)
      .send(materialPayload('AUD-001', 1))
      .expect(201);

    const logs = await request(app.getHttpServer())
      .get('/api/v1/audit-logs?action=MATERIAL_CREATE')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(logs.body.total).toBeGreaterThan(0);
    expect(logs.body.items[0]).toMatchObject({
      actor: 'supervisor',
      actorRole: 'supervisor',
      action: 'MATERIAL_CREATE',
      resourceId: 'AUD-001',
    });

    const keeper = await loginAs(app, 'warehouse');
    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${keeper}`)
      .expect(403);
  });

  it('修改自己的密码后旧密码失效', async () => {
    const token = await loginAs(app, 'operator');
    await request(app.getHttpServer())
      .post('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'newpass123' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'operator', password: 'axparts123' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'operator', password: 'newpass123' })
      .expect(200);
  });

  it('无令牌与坏令牌都被拒绝', async () => {
    await anonymous().get('/api/v1/dashboard').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });
});
