import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export class AlertQueryDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsIn(['LOW', 'STOCKOUT'])
  level?: 'LOW' | 'STOCKOUT';
}
