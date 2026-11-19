import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { Pagination, TableWrap } from '../../../components/ui/Table';
import { Select, TextInput } from '../../../components/ui/Field';
import { REQUEST_SOURCE_LABEL, REQUEST_STATUSES } from '../../../domain/enums';
import { statusText } from '../../../domain/purchase';
import { formatDate, formatDateTime } from '../../../domain/format';
import type { RequestStatus } from '../../../domain/types';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useQuery } from '../../../state/useQuery';

const PAGE_SIZE = 20;

function toneOf(status: RequestStatus, rejected: boolean) {
  if (rejected) return 'stockout' as const;
  if (status === 'COMPLETED') return 'normal' as const;
  if (status === 'PENDING') return 'low' as const;
  return 'brand' as const;
}

export function RequestListPage() {
  useDocumentTitle('采购申请');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [applicant, setApplicant] = useState('');

  const query = {
    page,
    pageSize: PAGE_SIZE,
    status: (status || undefined) as RequestStatus | undefined,
    applicant: applicant.trim() || undefined,
  };

  const { data, error, isLoading, refetch } = useQuery(
    `requests:${JSON.stringify(query)}`,
    () => api.purchase.listRequests(query),
    { tags: ['purchase.requests'] },
  );

  return (
    <>
      <PageHeader
        title="采购申请"
        description="驳回后状态仍为「待审批」，以驳回原因区分；重新提交会清空原因。"
        actions={
          <Link
            to={PATHS.requestNew()}
            className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white"
          >
            新建申请
          </Link>
        }
      />

      <div className="card mb-3 grid gap-3 p-3 sm:grid-cols-3">
        <div>
          <label htmlFor="rq-status" className="mb-1 block text-xs text-ink-500">
            状态
          </label>
          <Select
            id="rq-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">全部状态</option>
            {REQUEST_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="rq-applicant" className="mb-1 block text-xs text-ink-500">
            申请人
          </label>
          <TextInput
            id="rq-applicant"
            value={applicant}
            onChange={(event) => {
              setApplicant(event.target.value);
              setPage(1);
            }}
            placeholder="例如 warehouse"
          />
        </div>
        <div className="flex items-end">
          <Button
            onClick={() => {
              setStatus('');
              setApplicant('');
              setPage(1);
            }}
          >
            重置
          </Button>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={5} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="暂无采购申请" description="可以从预警页「生成采购建议」，或手工新建。" />
        ) : (
          <>
            <TableWrap caption={`共 ${data.total} 条申请`}>
              <thead>
                <tr>
                  <th scope="col">申请单号</th>
                  <th scope="col">SKU</th>
                  <th scope="col">数量</th>
                  <th scope="col">状态</th>
                  <th scope="col">申请人</th>
                  <th scope="col">来源</th>
                  <th scope="col">期望到货</th>
                  <th scope="col">更新时间</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const rejected = item.status === 'PENDING' && Boolean(item.rejectReason);
                  return (
                    <tr key={item.id}>
                      <th scope="row" className="font-mono text-xs font-normal text-ink-700">
                        {item.requestNo}
                      </th>
                      <td className="font-mono text-xs">{item.sku}</td>
                      <td className="tabular-nums">{item.quantity}</td>
                      <td>
                        <Badge tone={toneOf(item.status, rejected)}>{statusText(item)}</Badge>
                      </td>
                      <td className="text-xs">{item.applicant}</td>
                      <td className="text-xs text-ink-500">{REQUEST_SOURCE_LABEL[item.source] ?? item.source}</td>
                      <td className="text-xs">{formatDate(item.expectedDate)}</td>
                      <td className="text-xs text-ink-500">{formatDateTime(item.updatedAt)}</td>
                      <td>
                        <Button size="sm" onClick={() => navigate(PATHS.requestDetail(item.id))}>
                          详情 / 审批
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )
      ) : null}
    </>
  );
}
