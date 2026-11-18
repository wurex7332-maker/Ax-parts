import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/errors';

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
  return app;
}

export function api(app: INestApplication) {
  return request(app.getHttpServer());
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
