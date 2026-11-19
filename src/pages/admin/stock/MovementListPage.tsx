import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../api';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { Pagination, TableWrap } from '../../../components/ui/Table';
import { Select, TextInput } from '../../../components/ui/Field';
import { MOVEMENT_TYPES, movementLabel } from '../../../domain/enums';
import { formatDateTime, formatSignedQty } from '../../../domain/format';
import type { MovementType } from '../../../domain/types';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useQuery } from '../../../state/useQuery';

const PAGE_SIZE = 20;

export function MovementListPage() {
  useDocumentTitle('流水明细');
  const [params] = useSearchParams();
  const [page, setPage] = useState(1);
  const [sku, setSku] = useState(params.get('sku') ?? '');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = {
    page,
    pageSize: PAGE_SIZE,
    sku: sku.trim() || undefined,
    type: (type || undefined) as MovementType | undefined,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  };

  const { data, error, isLoading, refetch } = useQuery(
    `movements:${JSON.stringify(query)}`,
    () => api.stock.movements(query),
    { tags: ['movements'] },
  );

  return (
    <>
      <PageHeader
        title="流水明细"
        description="流水为追加写入，不可编辑或删除。时间筛选以 ISO 字符串传参，避免后端字符串比较失效。"
        breadcrumb={
          <Link to={PATHS.stock} className="underline decoration-dotted">
            库存台账
          </Link>
        }
      />

      <div className="card mb-3 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="mv-sku" className="mb-1 block text-xs text-ink-500">
            物料 SKU
          </label>
          <TextInput
            id="mv-sku"
            value={sku}
            onChange={(event) => {
              setSku(event.target.value);
              setPage(1);
            }}
            placeholder="例如 MON-004"
          />
        </div>
        <div>
          <label htmlFor="mv-type" className="mb-1 block text-xs text-ink-500">
            类型
          </label>
          <Select
            id="mv-type"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
          >
            <option value="">全部类型</option>
            {MOVEMENT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="mv-from" className="mb-1 block text-xs text-ink-500">
            起始日期
          </label>
          <TextInput
            id="mv-from"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <label htmlFor="mv-to" className="mb-1 block text-xs text-ink-500">
            截止日期
          </label>
          <TextInput
            id="mv-to"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-end">
          <Button
            onClick={() => {
              setSku('');
              setType('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            重置
          </Button>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={6} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="暂无流水" description="调整筛选条件，或先完成一次入库/出库/盘点。" />
        ) : (
          <>
            <TableWrap caption={`共 ${data.total} 条流水`}>
              <thead>
                <tr>
                  <th scope="col">时间</th>
                  <th scope="col">类型</th>
                  <th scope="col">SKU</th>
                  <th scope="col">库位</th>
                  <th scope="col">数量</th>
                  <th scope="col">操作人</th>
                  <th scope="col">领用人</th>
                  <th scope="col">关联单据</th>
                  <th scope="col">流水号</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap text-xs text-ink-600">{formatDateTime(item.occurredAt)}</td>
                    <td className="text-xs">{movementLabel(item.type)}</td>
                    <th scope="row" className="font-mono text-xs font-normal text-ink-700">
                      {item.sku}
                    </th>
                    <td className="text-xs">{item.location || '—'}</td>
                    <td
                      className={`tabular-nums font-medium ${item.quantitySigned > 0 ? 'text-normal-fg' : 'text-stockout-fg'}`}
                    >
                      {formatSignedQty(item.quantitySigned)}
                    </td>
                    <td className="text-xs text-ink-600">{item.operator || '—'}</td>
                    <td className="text-xs text-ink-600">{item.recipient || '—'}</td>
                    <td className="text-xs text-ink-500">{item.relatedDocNo || '—'}</td>
                    <td className="font-mono text-[11px] text-ink-400">{item.movementNo}</td>
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
