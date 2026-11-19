import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto, MaterialQueryDto, UpdateMaterialDto } from './dto';
import { CurrentUser } from '../../common/auth.decorators';
import type { AuthUser } from '../../common/jwt';
import { AuditService } from '../audit/audit.service';

@Controller('api/v1/materials')
export class MaterialsController {
  constructor(
    private readonly service: MaterialsService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  create(@Body() dto: CreateMaterialDto, @CurrentUser() user: AuthUser) {
    const material = this.service.create(dto);
    this.audit.log(user, {
      action: 'MATERIAL_CREATE',
      resource: 'material',
      resourceId: material.sku,
      detail: { name: material.name, category: material.category },
    });
    return material;
  }

  @Get()
  findAll(@Query() query: MaterialQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':sku')
  findOne(@Param('sku') sku: string) {
    return this.service.findOne(sku);
  }

  @Put(':sku')
  update(@Param('sku') sku: string, @Body() dto: UpdateMaterialDto, @CurrentUser() user: AuthUser) {
    const material = this.service.update(sku, dto);
    this.audit.log(user, {
      action: 'MATERIAL_UPDATE',
      resource: 'material',
      resourceId: sku,
      detail: { fields: Object.keys(dto) },
    });
    return material;
  }

  @Post(':sku/disable')
  disable(@Param('sku') sku: string, @CurrentUser() user: AuthUser) {
    const material = this.service.disable(sku);
    this.audit.log(user, { action: 'MATERIAL_DISABLE', resource: 'material', resourceId: sku });
    return material;
  }
}
