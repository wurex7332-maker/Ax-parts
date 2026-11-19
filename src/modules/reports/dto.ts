import { IsOptional, IsString } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export class ConsumptionRankQueryDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
