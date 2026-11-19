import type { Dashboard } from '../../domain/types';

const COLORS = {
  normal: '#11643a',
  low: '#8a5300',
  stockout: '#9c1c14',
} as const;

const SEGMENTS = [
  { key: 'normal', label: '正常', color: COLORS.normal },
  { key: 'low', label: '预警', color: COLORS.low },
  { key: 'stockout', label: '断料', color: COLORS.stockout },
] as const;

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * 健康度分布：图形 + aria-label 摘要 + 等价数据表（PRD §7.1「图表」）。
 */
export function HealthDistribution({ data }: { data: Dashboard['healthDistribution'] }) {
  const total = data.normal.count + data.low.count + data.stockout.count;
  const summary = `健康度分布：正常 ${data.normal.count} 项 ${pct(data.normal.percentage)}，预警 ${data.low.count} 项 ${pct(
    data.low.percentage,
  )}，断料 ${data.stockout.count} 项 ${pct(data.stockout.percentage)}，共 ${total} 项`;

  return (
    <section aria-labelledby="health-dist-title" className="card p-4">
      <h2 id="health-dist-title" className="text-sm font-semibold text-ink-900">
        健康度分布
      </h2>
      <p className="mt-0.5 text-xs text-ink-500">按 SKU 合计库存与安全库存判定，断料优先。</p>

      <div
        role="img"
        aria-label={summary}
        className="mt-4 flex h-6 w-full overflow-hidden rounded-md border border-line"
      >
        {SEGMENTS.map((segment) => {
          const value = data[segment.key];
          const width = total === 0 ? 0 : (value.count / total) * 100;
          if (width === 0) return null;
          return (
            <div
              key={segment.key}
              style={{ width: `${width}%`, backgroundColor: segment.color }}
              className="flex items-center justify-center"
            >
              <span className="truncate px-1 text-[10px] font-medium text-white">
                {segment.label} {value.count}
              </span>
            </div>
          );
        })}
        {total === 0 ? <div className="flex-1 bg-slate-100" /> : null}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-700">
        {SEGMENTS.map((segment) => {
          const value = data[segment.key];
          return (
            <li key={segment.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: segment.color }} />
              {segment.label}
              <strong className="tabular-nums">{value.count}</strong>
              <span className="text-ink-400">({pct(value.percentage)})</span>
            </li>
          );
        })}
      </ul>

      <details className="mt-3 rounded-lg border border-line bg-slate-50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-ink-700">查看数据表</summary>
        <table className="table-base mt-2">
          <caption className="sr-only">健康度分布数据表</caption>
          <thead>
            <tr>
              <th scope="col">状态</th>
              <th scope="col">数量</th>
              <th scope="col">占比</th>
            </tr>
          </thead>
          <tbody>
            {SEGMENTS.map((segment) => (
              <tr key={segment.key}>
                <th scope="row" className="font-normal">
                  {segment.label}
                </th>
                <td className="tabular-nums">{data[segment.key].count}</td>
                <td className="tabular-nums">{pct(data[segment.key].percentage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
