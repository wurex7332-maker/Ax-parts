import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/errors';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  // 前端可能以独立静态站点形式部署，需要跨域访问 API；仅测试项目使用，生产应改为白名单
  app.enableCors({
    origin: true,
    credentials: false,
    exposedHeaders: ['Content-Disposition'],
  });
  return app;
}

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Ax-parts backend listening on http://localhost:${port}`);
}

if (require.main === module) {
  void bootstrap();
}
