import type { Health } from './types';

/**
 * 三态判定，与后端 `src/domain/health.ts` 完全一致：
 * 先判断料（current <= 0），再判预警（current <= safetyStock），否则正常。
 * mock 适配器与 UI 共用此函数，避免两处实现漂移。
 */
export function healthOf(currentStock: number, safetyStock: number): Health {
  if (currentStock <= 0) return 'STOCKOUT';
  if (currentStock <= safetyStock) return 'LOW';
  return 'NORMAL';
}

/** 采购建议量，与后端 `src/domain/suggestion.ts` 一致 */
export function suggestedQtyOf(currentStock: number, safetyStock: number): number {
  return Math.max(2 * safetyStock - currentStock, 1);
}

/** 断料优先级恒高于预警，用于列表排序（与后端一致） */
export const HEALTH_RANK: Record<Health, number> = { STOCKOUT: 0, LOW: 1, NORMAL: 2 };
