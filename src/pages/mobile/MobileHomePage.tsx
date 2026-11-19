import { Link } from 'react-router-dom';
import { api } from '../../api';
import { HealthBadge } from '../../components/health/HealthBadge';
import { Badge, StatCard } from '../../components/ui/Feedback';
import { useDocumentTitle } from '../../hooks/useA11y';
import { PATHS } from '../../routes/paths';
import { useQuery } from '../../state/useQuery';
import { useSession } from '../../state/session';

export function MobileHomePage() {
  useDocumentTitle('辅料领用');
  const role = useSession((state) => state.role);
  const actor = useSession((state) => state.actor());

  const dashboard = useQuery('dashboard', () => api.dashboard(), { tags: ['dashboard'] });
  const unread = useQuery(
    `notifications:unread:${actor}`,
    () => api.notifications.list({ recipient: actor, isRead: 'false', pageSize: 200 }),
    { tags: ['notifications'] },
  );
  const pending = useQuery(
    'purchase:pending',
    () => api.purchase.listRequests({ status: 'PENDING', pageSize: 200 }),
    { tags: ['purchase.requests'] },
  );

  return (
    <div className="space-y-4">
      <h1 tabIndex={-1} className="text-lg font-semibold text-ink-900">
        辅料领用
      </h1>

      <div className="rounded-xl border border-line bg-white p-4">
        <p className="text-xs text-ink-500">当前视角</p>
        <p className="mt-0.5 text-sm font-semibold text-ink-900">
          {role === 'supervisor' ? '车间主管' : '领用人员'}
          <Badge className="ml-2">仅领用 / 查询 / 审批 / 消息</Badge>
        </p>
        {dashboard.data ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-600">
            <span>
              断料 <strong className="tabular-nums text-stockout-fg">{dashboard.data.stockoutCount}</strong>
            </span>
            <span>
              预警 <strong className="tabular-nums text-low-fg">{dashboard.data.alertCount}</strong>
            </span>
            <span>
              待审批 <strong className="tabular-nums text-brand-700">{pending.data?.total ?? 0}</strong>
            </span>
            {dashboard.data.stockoutCount > 0 ? <HealthBadge health="STOCKOUT" /> : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to={PATHS.scan}
          className="tap-target flex h-24 flex-col justify-between rounded-xl border border-line bg-white p-4"
        >
          <span className="text-sm font-semibold text-ink-900">扫码领用</span>
          <span className="text-[11px] text-ink-500">扫码 → 确认数量，共 2 步</span>
        </Link>
        <Link
          to={PATHS.mobileSearch}
          className="tap-target flex h-24 flex-col justify-between rounded-xl border border-line bg-white p-4"
        >
          <span className="text-sm font-semibold text-ink-900">库存查询</span>
          <span className="text-[11px] text-ink-500">按 SKU / 名称查询</span>
        </Link>
        {role === 'supervisor' ? (
          <Link
            to={PATHS.approvals}
            className="tap-target flex h-24 flex-col justify-between rounded-xl border border-line bg-white p-4"
          >
            <span className="text-sm font-semibold text-ink-900">审批</span>
            <span className="text-[11px] text-ink-500">待审批 {pending.data?.total ?? 0} 条</span>
          </Link>
        ) : null}
        <Link
          to={PATHS.mobileNotifications}
          className="tap-target flex h-24 flex-col justify-between rounded-xl border border-line bg-white p-4"
        >
          <span className="text-sm font-semibold text-ink-900">站内消息</span>
          <span className="text-[11px] text-ink-500">未读 {unread.data?.total ?? 0} 条</span>
        </Link>
      </div>

      {dashboard.data ? (
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="SKU 总数" value={dashboard.data.skuTotal} />
          <StatCard label="待采购" value={dashboard.data.pendingPurchaseCount} hint="待审批+已审批+采购中" />
        </div>
      ) : null}
    </div>
  );
}
