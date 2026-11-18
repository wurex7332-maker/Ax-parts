export type HealthLevel = 'STOCKOUT' | 'LOW' | 'NORMAL';

/**
 * 健康分桶（A4）：以当前库存判定，断料优先于预警。
 * current <= 0 -> STOCKOUT；current <= safety -> LOW；否则 NORMAL。
 */
export function classify(current: number, safety: number): HealthLevel {
  if (current <= 0) return 'STOCKOUT';
  if (current <= safety) return 'LOW';
  return 'NORMAL';
}

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  STOCKOUT: '断料',
  LOW: '预警',
  NORMAL: '正常',
};
