import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MaterialsModule } from '../materials/materials.module';
import { StockModule } from '../stock/stock.module';
import { PurchaseService } from './purchase.service';
import { PurchaseController } from './purchase.controller';

@Module({
  imports: [AuditModule, MaterialsModule, StockModule],
  controllers: [PurchaseController],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
