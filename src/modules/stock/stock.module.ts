import { Module } from '@nestjs/common';
import { MaterialsModule } from '../materials/materials.module';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';

@Module({
  imports: [MaterialsModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
