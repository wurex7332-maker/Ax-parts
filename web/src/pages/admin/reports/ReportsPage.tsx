import { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { api } from '../../../api';
import { HealthBadge } from '../../../components/health/HealthBadge';
import { PageHeader } from '../../../components/layout/PageHeader';
import { EmptyState, ErrorState, Skeleton, StatCard } from '../../../components/ui/Feedback';
import { TableWrap } from '../../../components/ui/Table';
import { MOVEMENT_TYPES, movementLabel, REQUEST_STATUSES } from '../../../domain/enums';
import type { MovementType } from '../../../domain/types';
import { formatDateTime, formatSignedQty } from '../../../domain/format';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS, REPORT_TABS } from '../../../routes/paths';
import { useQuery } from '../../../state/useQuery';

export function ReportsPage() {
  const { tab = 'movements' } = useParams<{ tab: string }>();
  const current = REPORT_TABS.find((item) => item.key === tab) ?? REPORT_TABS[0];
  useDocumentTitle(`报表 · ${current.label}`);

  return (
    <>
      <PageHeader
        title="报表中心"
        description="报表为只读视图，不支持导出或打印（范围外）。筛选能力受后端查询参数限制，其余在客户端处理。"
      />

      <nav aria-label="报表分类" className="mb-3 flex flex-wrap gap-1">
        {REPORT_TABS.map((item) => (
          <NavLink
            key={item.key}
            to={PATHS.reports(item.key)}
            className={({ isActive }) =>
              `tap-target inline-flex items-center rounded-lg border px-3 text-xs ${
                isActive
                  ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                  : 'border-line bg-white text-ink-700'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {tab === 'movements' ? <MovementsReport /> : null}
      {tab === 'consumption' ? <ConsumptionReport /> : null}
      {tab === 'alerts' ? <AlertsReport /> : null}
      {tab === 'purchase' ? <PurchaseReportPanel /> : null}
      {!['movements', 'consumption', 'alerts', 'purchase'].includes(tab) ? (
        <EmptyState title="未知报表" description="请从上方选择一个报表分类。" />
      ) : null}
    </>
  );
}

function MovementsReport() {
  const [sku, setSku] = useState('');
  const [type, setType] = useState('');
  const query = { page: 1, pageSize: 50, sku: sku.trim() || undefined, type: (type || undefined) as MovementType | undefined };
  const { data, error, isLoading, refetch } = useQuery(
    `report:movements:${JSON.stringify(query)}`,
    () => api.reports.movements(query),
    { tags: ['reports'] },
  );

  return (
    <section aria-labelledby="rep-mv">
      <h2 id="rep-mv" className="mb-2 text-sm font-semibold text-ink-900">
        出入库流水（最近 50 条）
      </h2>
      <div className="card mb-3 flex flex-wrap items-end gap-2 p-3">
        <div>
          <label htmlFor="rep-sku" className="mb-1 block text-xs text-ink-500">
            物料 SKU
          </label>
          <input
            id="rep-sku"
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            placeholder="例如 MON-004"
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="rep-type" className="mb-1 block text-xs text-ink-500">
            类型
          </label>
          <select
            id="rep-type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          >
            <option value="">全部</option>
            {MOVEMENT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={5} /> : null}
      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="暂无流水" />
        ) : (
          <TableWrap caption={`共 ${data.total} 条`}>
            <thead>
              <tr>
                <th scope="col">时间</th>
                <th scope="col">类型</th>
                <th scope="col">SKU</th>
                <th scope="col">数量</th>
                <th scope="col">操作人</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td className="text-xs">{formatDateTime(row.occurredAt)}</td>
                  <td className="text-xs">{movementLabel(row.type)}</td>
                  <th scope="row" className="font-mono text-xs font-normal">
                    {row.sku}
                  </th>
                  <td className="tabular-nums">{formatSignedQty(row.quantitySigned)}</td>
                  <td className="text-xs text-ink-500">{row.operator || '—'}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )
      ) : null}
    </section>
  );
}

function ConsumptionReport() {
  const { data, error, isLoading, refetch } = useQuery(
    'report:consumption',
    () => api.reports.consumptionRank({ page: 1, pageSize: 50 }),
    { tags: ['reports'] },
  );

  return (
    <section aria-labelledby="rep-cs">
      <h2 id="rep-cs" className="mb-2 text-sm font-semibold text-ink-900">
        消耗排行（仅统计领用出库）
      </h2>
      <p className="mb-2 text-xs text-ink-500">盘点盈亏与报损不计入「消耗」，与后端口径一致。</p>
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={5} /> : null}
      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="暂无领用记录" description="完成一次领用出库后即可看到排行。" />
        ) : (
          <TableWrap caption={`共 ${data.total} 个物料`}>
            <thead>
              <tr>
                <th scope="col">排名</th>
                <th scope="col">SKU</th>
                <th scope="col">名称</th>
                <th scope="col">累计领用量</th>
                <th scope="col">出库次数</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row, index) => (
                <tr key={row.sku}>
                  <td className="tabular-nums">{index + 1}</td>
                  <th scope="row" className="font-mono text-xs font-normal">
                    {row.sku}
                  </th>
                  <td>{row.name}</td>
                  <td className="tabular-nums font-medium">
                    {row.consumedQty} {row.unit}
                  </td>
                  <td className="tabular-nums text-ink-500">{row.issueCount}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )
      ) : null}
    </section>
  );
}

function AlertsReport() {
  const { data, error, isLoading, refetch } = useQuery(
    'report:alerts',
    () => api.reports.alerts({ page: 1, pageSize: 100 }),
    { tags: ['reports'] },
  );

  return (
    <section aria-labelledby="rep-al">
      <h2 id="rep-al" className="mb-2 text-sm font-semibold text-ink-900">
        预警清单
      </h2>
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={5} /> : null}
      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="当前无预警" />
        ) : (
          <TableWrap caption={`共 ${data.total} 项`}>
            <thead>
              <tr>
                <th scope="col">状态</th>
                <th scope="col">SKU</th>
                <th scope="col">名称</th>
                <th scope="col">当前</th>
                <th scope="col">安全库存</th>
                <th scope="col">建议量</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.sku}>
                  <td>
                    <HealthBadge health={row.level} currentStock={row.currentStock} safetyStock={row.safetyStock} />
                  </td>
                  <th scope="row" className="font-mono text-xs font-normal">
                    {row.sku}
                  </th>
                  <td>{row.name}</td>
                  <td className="tabular-nums">{row.currentStock}</td>
                  <td className="tabular-nums text-ink-500">{row.safetyStock}</td>
                  <td className="tabular-nums">{row.suggestedQty}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )
      ) : null}
      <p className="mt-2 text-xs text-ink-500">
        需要发起采购？
        <Link to={PATHS.alerts} className="ml-1 text-brand-700 underline">
          前往预警页一键生成建议
        </Link>
      </p>
    </section>
  );
}

function PurchaseReportPanel() {
  const { data, error, isLoading, refetch } = useQuery('report:purchase', () => api.reports.purchase(), {
    tags: ['reports'],
  });

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !data) return <Skeleton rows={5} />;

  return (
    <section aria-labelledby="rep-pu">
      <h2 id="rep-pu" className="mb-2 text-sm font-semibold text-ink-900">
        采购统计
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="申请总量" value={data.totalRequestedQty} hint="所有申请数量合计" />
        <StatCard label="下单总量" value={data.totalOrderedQty} hint="所有采购订单数量合计" />
        <StatCard label="已到货量" value={data.arrivedQty} hint="已关单订单数量合计" />
        <StatCard label="未关单" value={data.openOrders} hint="待执行到货的订单数" />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {REQUEST_STATUSES.map((status) => {
          const entry = data.statusCounts?.[status.value];
          return (
            <div key={status.value} className="card p-3">
              <p className="text-xs text-ink-500">{entry?.label ?? status.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{entry?.count ?? 0}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
