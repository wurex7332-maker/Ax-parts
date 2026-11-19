import { HEALTH_LABEL } from '../../domain/enums';
import type { Health } from '../../domain/types';

const STYLES: Record<Health, { box: string; icon: string; iconLabel: string }> = {
  NORMAL: { box: 'bg-normal-bg text-normal-fg border-normal-bd', icon: '✓', iconLabel: '对勾' },
  LOW: { box: 'bg-low-bg text-low-fg border-low-bd', icon: '▲', iconLabel: '三角感叹' },
  STOCKOUT: { box: 'bg-stockout-bg text-stockout-fg border-stockout-bd font-semibold', icon: '✕', iconLabel: '叉号' },
};

export interface HealthBadgeProps {
  health: Health;
  currentStock?: number;
  safetyStock?: number;
  className?: string;
}

/**
 * 三态唯一出口：颜色 + 图标形状 + 文字三重编码，禁止只靠颜色（PRD §6.1）。
 */
export function HealthBadge({ health, currentStock, safetyStock, className = '' }: HealthBadgeProps) {
  const style = STYLES[health];
  const label = HEALTH_LABEL[health];
  const detail =
    currentStock !== undefined && safetyStock !== undefined
      ? `当前 ${currentStock}，安全库存 ${safetyStock}`
      : undefined;

  const ariaLabel =
    health === 'STOCKOUT'
      ? `状态：断料${detail ? `（${detail}，需立即补货）` : '，需立即补货'}`
      : health === 'LOW'
        ? `状态：预警${detail ? `（${detail}，低于安全库存）` : '，低于安全库存'}`
        : `状态：正常${detail ? `（${detail}）` : ''}`;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      title={detail}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs ${style.box} ${className}`}
    >
      <span aria-hidden="true" className="leading-none">
        {style.icon}
      </span>
      <span aria-hidden="true">{label}</span>
    </span>
  );
}

export function HealthLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
      <span className="font-medium text-ink-700">三态图例：</span>
      <HealthBadge health="NORMAL" />
      <HealthBadge health="LOW" />
      <HealthBadge health="STOCKOUT" />
      <span className="text-[11px] text-ink-400">断料优先级高于预警；状态同时以图标与文字标注，不只依赖颜色。</span>
    </div>
  );
}
