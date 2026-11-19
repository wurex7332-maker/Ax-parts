import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export const CATEGORIES = ['计算机设备', '计算机配件', '打印设备', '耗材', '网络设备'] as const;
export const UNITS = ['台', '个', '盒', '箱'] as const;
export const MATERIAL_STATUSES = ['ENABLED', 'DISABLED'] as const;

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsOptional()
  specModel = '';

  @IsString()
  @IsOptional()
  brand = '';

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  priceCents = 0;

  @IsInt()
  @Min(0)
  safetyStock: number;

  @IsString()
  @IsOptional()
  supplier = '';

  @IsString()
  @IsOptional()
  imageUrl = '';
}

export class UpdateMaterialDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  specModel?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  location?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  priceCents?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  safetyStock?: number;

  @IsString()
  @IsOptional()
  supplier?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;
}

export class MaterialQueryDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(MATERIAL_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  sku?: string;
}

/** 兼容 snake_case 客户端字段的映射由 README 说明，服务端统一 camelCase。 */
export type MaterialRow = {
  sku: string;
  name: string;
  category: string;
  spec_model: string;
  brand: string;
  unit: string;
  location: string;
  price_cents: number;
  safety_stock: number;
  supplier: string;
  image_url: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export function toMaterialView(row: MaterialRow) {
  return {
    sku: row.sku,
    name: row.name,
    category: row.category,
    specModel: row.spec_model,
    brand: row.brand,
    unit: row.unit,
    location: row.location,
    priceCents: row.price_cents,
    safetyStock: row.safety_stock,
    supplier: row.supplier,
    imageUrl: row.image_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function materialColumnMap(key: string): string {
  const map: Record<string, string> = {
    name: 'name',
    category: 'category',
    specModel: 'spec_model',
    brand: 'brand',
    unit: 'unit',
    location: 'location',
    priceCents: 'price_cents',
    safetyStock: 'safety_stock',
    supplier: 'supplier',
    imageUrl: 'image_url',
  };
  return map[key] ?? key;
}

export { Type };
