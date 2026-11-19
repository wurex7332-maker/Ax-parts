import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export class NotificationQueryDto extends PaginationQuery {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id?: number;

  @IsOptional()
  recipient?: string;

  @IsOptional()
  @IsIn(['0', '1', 'true', 'false'])
  isRead?: string;
}
