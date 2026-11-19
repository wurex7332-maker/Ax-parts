import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { StockModule } from '../stock/stock.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [StockModule, AlertsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
