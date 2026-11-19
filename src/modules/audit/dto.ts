import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQuery } from '../../common/pagination';

export class AuditQueryDto extends PaginationQuery {
  @IsOptional()
  @IsString()
  actor?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  resource?: string;

  /** ISO8601 字符串，按 created_at 比较 */
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class ChangePasswordDto {
  @IsString()
  password: string;
}

export const AUDIT_ACTIONS = [
  'AUTH_LOGIN',
  'MATERIAL_CREATE',
  'MATERIAL_UPDATE',
  'MATERIAL_DISABLE',
  'STOCK_INBOUND',
  'STOCK_OUTBOUND',
  'STOCK_COUNT',
  'STOCK_ADJUST',
  'PURCHASE_CREATE',
  'PURCHASE_APPROVE',
  'PURCHASE_REJECT',
  'PURCHASE_RESUBMIT',
  'PURCHASE_ORDER_CREATE',
  'PURCHASE_ARRIVE',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_RESET_PASSWORD',
  'DICTIONARY_CREATE',
  'DICTIONARY_UPDATE',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export class AuditActionQueryDto extends PaginationQuery {
  @IsOptional()
  @IsIn(AUDIT_ACTIONS as unknown as string[])
  action?: string;
}
