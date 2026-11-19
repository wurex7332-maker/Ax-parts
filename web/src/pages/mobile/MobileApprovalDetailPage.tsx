import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import { RequestActions } from '../../components/domain/RequestActions';
import { StatusStepper } from '../../components/domain/StatusStepper';
import { Badge, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { REQUEST_SOURCE_LABEL } from '../../domain/enums';
import { formatDate } from '../../domain/format';
import { isRejected, statusText } from '../../domain/purchase';
import { useDocumentTitle } from '../../hooks/useA11y';
import { PATHS } from '../../routes/paths';
import { useQuery } from '../../state/useQuery';

export function MobileApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const requestId = Number(id);
  useDocumentTitle('审批详情');

  const { data, error, isLoading, refetch } = useQuery(
    `request:${requestId}`,
    () => api.purchase.getRequest(requestId),
    { tags: ['purchase.requests'] },
  );

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !data) return <Skeleton rows={5} />;

  const rejected = isRejected(data);

  return (
    <div className="space-y-3 pb-4">
      <Link to={PATHS.approvals} className="text-xs text-ink-500 underline decoration-dotted">
        ← 返回待审批列表
      </Link>

      <div className="flex items-center justify-between gap-2">
        <h1 tabIndex={-1} className="font-mono text-base font-semibold text-ink-900">
          {data.requestNo}
        </h1>
        <Badge tone={rejected ? 'stockout' : data.status === 'COMPLETED' ? 'normal' : 'brand'}>
          {statusText(data)}
        </Badge>
      </div>

      <div className="card p-3">
        <StatusStepper status={data.status} rejected={rejected} />
      </div>

      {rejected ? (
        <section aria-labelledby="m-reject" className="rounded-xl border border-stockout-bd bg-stockout-bg px-3 py-2">
          <h2 id="m-reject" className="text-xs font-semibold text-stockout-fg">
            ⚠ 驳回原因
          </h2>
          <p className="mt-1 text-xs leading-5 text-stockout-fg">{data.rejectReason}</p>
        </section>
      ) : null}

      <div className="card p-3">
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-ink-500">物料</dt>
            <dd className="font-mono text-ink-900">{data.sku}</dd>
          </div>
          <div>
            <dt className="text-ink-500">数量</dt>
            <dd className="tabular-nums text-ink-900">{data.quantity}</dd>
          </div>
          <div>
            <dt className="text-ink-500">期望到货</dt>
            <dd className="text-ink-900">{formatDate(data.expectedDate)}</dd>
          </div>
          <div>
            <dt className="text-ink-500">申请人</dt>
            <dd className="text-ink-900">{data.applicant}</dd>
          </div>
          <div>
            <dt className="text-ink-500">来源</dt>
            <dd className="text-ink-900">{REQUEST_SOURCE_LABEL[data.source] ?? data.source}</dd>
          </div>
          <div>
            <dt className="text-ink-500">版本</dt>
            <dd className="tabular-nums text-ink-900">v{data.version}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-ink-500">理由 / 备注</dt>
            <dd className="mt-0.5 whitespace-pre-wrap leading-5 text-ink-900">{data.reason || '—'}</dd>
          </div>
        </dl>
      </div>

      <section
        aria-labelledby="m-actions"
        className="sticky bottom-20 rounded-xl border border-line bg-white p-3 shadow-sm"
      >
        <h2 id="m-actions" className="mb-2 text-xs font-semibold text-ink-900">
          审批操作
        </h2>
        <RequestActions request={data} layout="mobile" />
      </section>
    </div>
  );
}
