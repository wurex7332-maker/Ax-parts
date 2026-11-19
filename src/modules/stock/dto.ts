import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export const MOVEMENT_TYPES = [
  'IN_PURCHASE',
  'IN_RETURN',
  'OUT_ISSUE',
  'COUNT_GAIN',
  'COUNT_LOSS',
  'ADJUST_LOSS',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'REVERSAL',
] as const;
export const INBOUND_SOURCES = ['PURCHASE', 'RETURN'] as const;
export const ADJUST_TYPES = ['LOSS', 'TRANSFER'] as const;

export class StockQueryDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class InboundDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsIn(INBOUND_SOURCES)
  source: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  batch?: string;

  @IsOptional()
  @IsString()
  relatedDocNo?: string;
}

export class OutboundDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  recipient: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  batch?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class CountDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsInt()
  @Min(0)
  actualQty: number;
}

export class AdjustDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsIn(ADJUST_TYPES)
  type: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  sourceLocation?: string;

  @IsOptional()
  @IsString()
  targetLocation?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  batch?: string;
}

export class MovementQueryDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  operator?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
