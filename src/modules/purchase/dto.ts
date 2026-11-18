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

export const PURCHASE_SOURCES = ['ALERT', 'MANUAL'] as const;
export const PURCHASE_STATUSES = [
  'PENDING',
  'APPROVED',
  'PURCHASING',
  'ARRIVED',
  'COMPLETED',
] as const;

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  expectedDate: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsIn(PURCHASE_SOURCES)
  source = 'MANUAL';

  @IsOptional()
  @IsString()
  applicant = 'applicant';
}

export class RejectDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class CreateOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class RequestQueryDto extends PaginationQuery {
  @IsOptional()
  @IsIn(PURCHASE_STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  applicant?: string;
}
