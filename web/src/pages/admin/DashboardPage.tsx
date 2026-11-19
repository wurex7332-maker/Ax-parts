import { Link } from 'react-router-dom';
import { api } from '../../api';
import { HealthDistribution } from '../../components/health/HealthDistribution';
import { HealthLegend } from '../../components/health/HealthBadge';
import { PageHeader } from '../../components/layout/PageHeader';
import { EmptyState, ErrorState, Skeleton, StatCard } from '../../components/ui/Feedback';
import { useDocumentTitle } from '../../hooks/useA11y';
import { PATHS } from '../../routes/paths';
import { useQuery } from '../../state/useQuery';

export function DashboardPage() {
  useDocumentTitle('首页看板');
  const { data, error, isLoading, refetch } = useQuery('dashboard', () => api.dashboard(), {
    tags: ['dashboard'],
  });

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !data) return <Skeleton rows={6} />;

  return (
    <>
      <PageHeader
        title="首页看板"
        description="指标口径与后端字段一一对应：预警数只统计「预警」，断料单列，二者不相加。"
        actions={
          <Link
            to={PATHS.alerts}
            className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm text-ink-700"
          >
            查看预警清单
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="SKU 总数" value={data.skuTotal} hint="全部辅料档案数" />
        <StatCard label="预警数" value={data.alertCount} hint="当前库存 ≤ 安全库存（不含断料）" />
        <StatCard label="断料数" value={data.stockoutCount} hint="当前库存 ≤ 0，优先级最高" />
        <StatCard
          label="待采购数"
          value={data.pendingPurchaseCount}
          hint="待审批 + 已审批 + 采购中"
        />
      </div>

      <div className="mt-3">
        <HealthLegend />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <HealthDistribution data={data.healthDistribution} />

        <section aria-labelledby="quick-title" className="card p-4">
          <h2 id="quick-title" className="text-sm font-semibold text-ink-900">
            快捷入口
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">库管常用操作，入库与出库均不超过 3 步。</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              to={PATHS.stockInbound('PURCHASE')}
              className="tap-target flex items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink-800 hover:bg-slate-50"
            >
              采购入库
            </Link>
            <Link
              to={PATHS.stockInbound('RETURN')}
              className="tap-target flex items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink-800 hover:bg-slate-50"
            >
              退料入库
            </Link>
            <Link
              to={PATHS.stockOutbound}
              className="tap-target flex items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink-800 hover:bg-slate-50"
            >
              领用出库
            </Link>
            <Link
              to={PATHS.materials}
              className="tap-target flex items-center justify-center rounded-lg border border-line bg-white px-3 text-sm text-ink-800 hover:bg-slate-50"
            >
              辅料档案
            </Link>
          </div>

          {data.stockoutCount === 0 && data.alertCount === 0 ? (
            <div className="mt-3">
              <EmptyState title="当前无预警" description="所有物料库存均高于安全库存。" />
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-stockout-bg px-3 py-2 text-xs text-stockout-fg">
              当前有 {data.stockoutCount} 项断料、{data.alertCount} 项预警，建议优先处理断料项。
            </p>
          )}
        </section>
      </div>
    </>
  );
}
