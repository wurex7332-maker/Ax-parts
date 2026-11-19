import { healthOf } from '../../domain/health';
import type { MovementType } from '../../domain/types';
import type { MockDb, StockCell } from './db';

export function findCell(db: MockDb, sku: string, location: string): StockCell | undefined {
  return db.cells.find((c) => c.sku === sku && c.location === location);
}

export function ensureCell(db: MockDb, sku: string, location: string): StockCell {
  let cell = findCell(db, sku, location);
  if (!cell) {
    cell = { sku, location, qty: 0, locked: 0 };
    db.cells.push(cell);
  }
  return cell;
}

export function skuQty(db: MockDb, sku: string): number {
  return db.cells.filter((c) => c.sku === sku).reduce((sum, c) => sum + c.qty, 0);
}

export function skuLocked(db: MockDb, sku: string): number {
  return db.cells.filter((c) => c.sku === sku).reduce((sum, c) => sum + c.locked, 0);
}

export function skuSafety(db: MockDb, sku: string): number {
  return db.materials.find((m) => m.sku === sku)?.safetyStock ?? 0;
}

export function skuHealth(db: MockDb, sku: string) {
  return healthOf(skuQty(db, sku), skuSafety(db, sku));
}

/** 可领用数量按 SKU 合计校验（后端行为） */
export function availableForIssue(db: MockDb, sku: string): number {
  return Math.max(skuQty(db, sku) - skuLocked(db, sku), 0);
}

/** 台账行可用量：库位库存 − SKU 级锁定（复刻后端口径，多库位时不自洽，见 DIVERGENCE） */
export function availableOfCell(db: MockDb, cell: StockCell): number {
  return Math.max(cell.qty - skuLocked(db, cell.sku), 0);
}

export function nextMovementNo(db: MockDb): string {
  return `MVT-${String(db.seq.movement).padStart(6, '0')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export const MOVEMENT_SIGN: Record<MovementType, 1 | -1> = {
  IN_PURCHASE: 1,
  IN_RETURN: 1,
  OUT_ISSUE: -1,
  COUNT_GAIN: 1,
  COUNT_LOSS: -1,
  ADJUST_LOSS: -1,
  TRANSFER_OUT: -1,
  TRANSFER_IN: 1,
  REVERSAL: 1,
};
