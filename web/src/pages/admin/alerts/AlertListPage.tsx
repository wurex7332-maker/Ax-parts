import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { HealthBadge, HealthLegend } from '../../../components/health/HealthBadge';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { Pagination, TableWrap } from '../../../components/ui/Table';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useQuery } from '../../../state/useQuery';

const PAGE_SIZE = 20;

export function AlertListPage() {
  useDocumentTitle('低库存预警');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, error, isLoading, refetch } = useQuery(
    `alerts:${page}:${pageSize}`,
    () => api.alerts.list({ page, pageSize }),
    { tags: ['alerts'] },
  );

  const stockout = data?.items.filter((item) => item.level === 'STOCKOUT') ?? [];
  const low = data?.items.filter((item) => item.level === 'LOW') ?? [];

  return (
    <>
      <PageHeader
        title="低库存预警"
        description="判定口径：当前库存 ≤ 0 为断料，当前库存 ≤ 安全库存为预警。断料优先级恒高于预警，列表已按此排序。"
        actions={
          <Button
            onClick={() => setPageSize(200)}
            disabled={pageSize === 200}
            title="一次加载全部预警项，便于批量查看"
          >
            加载全部
          </Button>
        }
      />

      <div className="mb-3">
        <HealthLegend />
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={5} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="当前无预警" description="所有物料库存均高于安全库存。" />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <Badge tone="stockout">断料 {stockout.length} 项</Badge>
              <Badge tone="low">预警 {low.length} 项</Badge>
              <span className="text-ink-500">共 {data.total} 项</span>
            </div>

            <TableWrap caption="预警清单（断料优先，其次按缺口从大到小）">
              <thead>
                <tr>
                  <th scope="col">级别</th>
                  <th scope="col">SKU</th>
                  <th scope="col">名称</th>
                  <th scope="col">当前库存</th>
                  <th scope="col">安全库存</th>
                  <th scope="col">库位</th>
                  <th scope="col">建议采购量</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.sku} className={item.level === 'STOCKOUT' ? 'bg-stockout-bg/40' : undefined}>
                    <td>
                      <HealthBadge health={item.level} currentStock={item.currentStock} safetyStock={item.safetyStock} />
                    </td>
                    <th scope="row" className="font-mono text-xs font-normal text-ink-700">
                      {item.sku}
                    </th>
                    <td>{item.name}</td>
                    <td className="tabular-nums font-medium">{item.currentStock}</td>
                    <td className="tabular-nums text-ink-500">{item.safetyStock}</td>
                    <td className="text-xs">{item.location}</td>
                    <td className="tabular-nums">{item.suggestedQty}</td>
                    <td>
                      <Button
                        size="sm"
                        variant={item.level === 'STOCKOUT' ? 'primary' : 'secondary'}
                        onClick={() =>
                          navigate(PATHS.requestNew({ from: 'alert', sku: item.sku, qty: item.suggestedQty }))
                        }
                      >
                        生成采购建议
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>

            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )
      ) : null}
    </>
  );
}
