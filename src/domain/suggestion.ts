import { HealthLevel } from './health';

/** A6：建议采购量 = max(2 × 安全库存 − 当前库存, 1)。 */
export function suggestedQuantity(current: number, safety: number): number {
  return Math.max(2 * safety - current, 1);
}

export function isSuggestionCandidate(
  level: HealthLevel,
  enabled: boolean,
): boolean {
  return enabled && (level === 'LOW' || level === 'STOCKOUT');
}
