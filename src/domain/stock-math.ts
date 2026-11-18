import { DomainError } from './domain-error';

export interface SignedRow {
  quantity_signed: number;
}

/** 当前库存 = 全部流水带符号数量之和（调拨两行净额为 0）。 */
export function sumSigned(rows: readonly SignedRow[]): number {
  return rows.reduce((total, row) => total + row.quantity_signed, 0);
}

/** 可用库存 = 当前库存 − 锁定库存。 */
export function availableStock(current: number, locked: number): number {
  return current - locked;
}

/** 出库前校验：可用库存不足则拒绝，不允许扣成负数。 */
export function assertSufficient(available: number, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError('INVALID_QUANTITY', '出库数量必须为正整数');
  }
  if (available < quantity) {
    throw new DomainError('STOCK_INSUFFICIENT', `可用库存不足: 需 ${quantity}，可用 ${available}`);
  }
}

/** 盘点差额：实盘数 − 账面数。 */
export function countDifference(actual: number, book: number): number {
  return actual - book;
}

export type CountAction = 'COUNT_GAIN' | 'COUNT_LOSS' | null;

export function countAction(diff: number): CountAction {
  if (diff > 0) return 'COUNT_GAIN';
  if (diff < 0) return 'COUNT_LOSS';
  return null;
}

export interface TransferLegs {
  out: { quantity_signed: number; location: string };
  in: { quantity_signed: number; location: string };
}

/** 调拨：源库位负、目标库位正，SKU 总量不变。 */
export function transferLegs(quantity: number, source: string, target: string): TransferLegs {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError('INVALID_QUANTITY', '调拨数量必须为正整数');
  }
  if (source === target) {
    throw new DomainError('SAME_LOCATION', '调拨源库位与目标库位不能相同');
  }
  return {
    out: { quantity_signed: -quantity, location: source },
    in: { quantity_signed: quantity, location: target },
  };
}

export interface ReversalInput {
  movementNo: string;
  quantitySigned: number;
}

/** 冲正只新增反向流水，原流水保持不动。 */
export function reversalOf(original: ReversalInput) {
  return {
    related_movement_no: original.movementNo,
    quantity_signed: -original.quantitySigned,
    type: 'REVERSAL' as const,
  };
}
