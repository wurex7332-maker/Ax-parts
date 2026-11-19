import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto, MaterialQueryDto, UpdateMaterialDto } from './dto';

@Controller('api/v1/materials')
export class MaterialsController {
  constructor(private readonly service: MaterialsService) {}

  @Post()
  create(@Body() dto: CreateMaterialDto) {
    return this.service.create(dto);
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
  update(@Param('sku') sku: string, @Body() dto: UpdateMaterialDto) {
    return this.service.update(sku, dto);
  }

  @Post(':sku/disable')
  disable(@Param('sku') sku: string) {
    return this.service.disable(sku);
  }
}
