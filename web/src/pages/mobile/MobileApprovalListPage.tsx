import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { statusText } from '../../domain/purchase';
import { formatDate } from '../../domain/format';
import { useDocumentTitle } from '../../hooks/useA11y';
import { PATHS } from '../../routes/paths';
import { useQuery } from '../../state/useQuery';

export function MobileApprovalListPage() {
  useDocumentTitle('审批');
  const { data, error, isLoading, refetch } = useQuery(
    'purchase:pending',
    () => api.purchase.listRequests({ status: 'PENDING', pageSize: 200 }),
    { tags: ['purchase.requests'] },
  );

  return (
    <div className="space-y-3">
      <h1 tabIndex={-1} className="text-lg font-semibold text-ink-900">
        待审批申请
      </h1>
      <p className="text-xs text-ink-500">与 Web 端读取同一份状态，任一端处理后另一端刷新即可见。</p>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={3} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="没有待审批申请" description="新的申请提交后会出现在这里。" />
        ) : (
          <ul className="space-y-2">
            {data.items.map((item) => {
              const rejected = Boolean(item.rejectReason);
              return (
                <li key={item.id}>
                  <Link
                    to={PATHS.approvalDetail(item.id)}
                    className="tap-target block rounded-xl border border-line bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-ink-600">{item.requestNo}</span>
                      <Badge tone={rejected ? 'stockout' : 'low'}>{statusText(item)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-900">
                      {item.sku} × {item.quantity}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{item.reason}</p>
                    <p className="mt-1 text-[11px] text-ink-400">
                      申请人 {item.applicant}｜期望到货 {formatDate(item.expectedDate)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </div>
  );
}
