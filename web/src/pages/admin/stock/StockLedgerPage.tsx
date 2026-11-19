import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../api';
import { HealthBadge, HealthLegend } from '../../../components/health/HealthBadge';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { Pagination, TableWrap } from '../../../components/ui/Table';
import { TextInput } from '../../../components/ui/Field';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useQuery } from '../../../state/useQuery';

const PAGE_SIZE = 20;

export function StockLedgerPage() {
  useDocumentTitle('库存台账');
  const [params] = useSearchParams();
  const [sku, setSku] = useState(params.get('sku') ?? '');
  const [page, setPage] = useState(1);

  const query = { page, pageSize: PAGE_SIZE, sku: sku.trim() || undefined };
  const { data, error, isLoading, refetch } = useQuery(`stock:${JSON.stringify(query)}`, () => api.stock.list(query), {
    tags: ['stock'],
  });

  return (
    <>
      <PageHeader
        title="库存台账"
        description="按「物料 × 库位」展示。行内库存是库位级数量，状态徽标按该物料的合计库存判定，两者口径不同。"
        actions={
          <>
            <Link
              to={PATHS.stockInbound('PURCHASE')}
              className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white"
            >
              采购入库
            </Link>
            <Link
              to={PATHS.stockOutbound}
              className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm text-ink-700"
            >
              领用出库
            </Link>
          </>
        }
      />

      <div className="mb-3">
        <HealthLegend />
      </div>

      <div className="card mb-3 flex flex-wrap items-end gap-2 p-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="stock-sku" className="mb-1 block text-xs text-ink-500">
            物料 SKU
          </label>
          <TextInput
            id="stock-sku"
            value={sku}
            onChange={(event) => {
              setSku(event.target.value);
              setPage(1);
            }}
            placeholder="精确匹配，例如 MON-004"
          />
        </div>
        <Button onClick={() => setPage(1)}>查询</Button>
        <Link
          to={PATHS.stockMovements}
          className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm text-ink-700"
        >
          流水明细
        </Link>
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={6} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="暂无库存记录" description="试试清空 SKU 筛选，或先完成一次入库。" />
        ) : (
          <>
            <TableWrap caption={`共 ${data.total} 条库存记录（物料 × 库位）`}>
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">库位</th>
                  <th scope="col">库位库存</th>
                  <th scope="col">SKU 合计</th>
                  <th scope="col">锁定</th>
                  <th scope="col">可用</th>
                  <th scope="col">安全库存</th>
                  <th scope="col">状态</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={`${row.sku}-${row.location}`}>
                    <th scope="row" className="font-mono text-xs font-normal text-ink-700">
                      {row.sku}
                    </th>
                    <td className="text-xs">{row.location || '—'}</td>
                    <td className="tabular-nums">{row.currentStock}</td>
                    <td className="tabular-nums font-medium">{row.skuCurrentStock}</td>
                    <td className="tabular-nums text-ink-500">{row.lockedStock}</td>
                    <td className="tabular-nums">{row.availableStock}</td>
                    <td className="tabular-nums text-ink-500">{row.safetyStock}</td>
                    <td>
                      <HealthBadge
                        health={row.health}
                        currentStock={row.skuCurrentStock}
                        safetyStock={row.safetyStock}
                      />
                    </td>
                    <td>
                      <Link
                        to={`${PATHS.stockMovements}?sku=${encodeURIComponent(row.sku)}`}
                        className="text-xs text-brand-700 underline decoration-dotted"
                      >
                        查看流水
                      </Link>
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
