import { Controller, Get, Module } from '@nestjs/common';
import { DatabaseModule } from './infra/database.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { StockModule } from './modules/stock/stock.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PurchaseModule } from './modules/purchase/purchase.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    DatabaseModule,
    MaterialsModule,
    StockModule,
    AlertsModule,
    NotificationsModule,
    PurchaseModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
