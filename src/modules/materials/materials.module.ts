import { Module } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { MaterialsController } from './materials.controller';
import { DictionariesModule } from '../dictionaries/dictionaries.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DictionariesModule, AuditModule],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
