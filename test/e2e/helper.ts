import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/errors';

const DEFAULT_USERNAME = 'supervisor';
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'axparts123';

/** 令牌可跨测试应用复用：同一密钥，载荷为种子用户 supervisor。 */
let cachedToken: string | null = null;

export async function createTestApp(): Promise<INestApplication> {
  process.env.DATABASE_PATH = ':memory:';
  delete process.env.SKIP_SEED;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();

  if (!cachedToken) {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: DEFAULT_USERNAME, password: DEFAULT_PASSWORD })
      .expect(200);
    cachedToken = login.body.token as string;
  }
  return app;
}

export async function loginAs(
  app: INestApplication,
  username: string,
  password = DEFAULT_PASSWORD,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ username, password })
    .expect(200);
  return res.body.token as string;
}

/**
 * 带默认令牌的请求入口，原有用例无需改动即可通过鉴权。
 * 需要验证匿名访问或越权时，直接用 supertest + app.getHttpServer()。
 */
export function api(app: INestApplication) {
  const server = app.getHttpServer();
  const withAuth =
    (method: 'get' | 'post' | 'put' | 'patch' | 'delete') =>
    (url: string) =>
      request(server)[method](url).set('Authorization', `Bearer ${cachedToken ?? ''}`);
  return {
    get: withAuth('get'),
    post: withAuth('post'),
    put: withAuth('put'),
    patch: withAuth('patch'),
    delete: withAuth('delete'),
  };
}

export function materialPayload(sku: string, safetyStock = 2) {
  return {
    sku,
    name: `测试物料 ${sku}`,
    category: '耗材',
    specModel: 'T-1',
    brand: 'Test',
    unit: '个',
    location: 'T-01',
    priceCents: 100,
    safetyStock,
    supplier: '测试供应商',
    imageUrl: '',
  };
}
