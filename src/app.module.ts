import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './infra/database.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { StockModule } from './modules/stock/stock.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PurchaseModule } from './modules/purchase/purchase.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
import { DictionariesModule } from './modules/dictionaries/dictionaries.module';
import { JwtAuthGuard, RolesGuard } from './modules/auth/guards';
import { Public } from './common/auth.decorators';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    AuditModule,
    DictionariesModule,
    MaterialsModule,
    StockModule,
    AlertsModule,
    NotificationsModule,
    PurchaseModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    // 顺序重要：先认证（401）再鉴权（403）
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
