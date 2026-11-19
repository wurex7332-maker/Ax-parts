import { Link, useParams } from 'react-router-dom';
import { api } from '../../../api';
import { RequestActions } from '../../../components/domain/RequestActions';
import { StatusStepper } from '../../../components/domain/StatusStepper';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { REQUEST_SOURCE_LABEL } from '../../../domain/enums';
import { formatDate, formatDateTime } from '../../../domain/format';
import { isRejected, statusText } from '../../../domain/purchase';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useQuery } from '../../../state/useQuery';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const requestId = Number(id);
  useDocumentTitle('采购申请详情');

  const { data, error, isLoading, refetch } = useQuery(
    `request:${requestId}`,
    () => api.purchase.getRequest(requestId),
    { tags: ['purchase.requests'] },
  );

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !data) return <Skeleton rows={6} />;

  const rejected = isRejected(data);

  return (
    <>
      <PageHeader
        title={`采购申请 ${data.requestNo}`}
        breadcrumb={
          <Link to={PATHS.requests} className="underline decoration-dotted">
            采购申请
          </Link>
        }
        actions={
          <Badge tone={rejected ? 'stockout' : data.status === 'COMPLETED' ? 'normal' : 'brand'}>
            {statusText(data)}
          </Badge>
        }
      />

      <div className="card mb-3 p-4">
        <StatusStepper status={data.status} rejected={rejected} />
      </div>

      {rejected ? (
        <section
          aria-labelledby="reject-title"
          className="mb-3 rounded-xl border border-stockout-bd bg-stockout-bg px-4 py-3"
        >
          <h2 id="reject-title" className="flex items-center gap-1.5 text-sm font-semibold text-stockout-fg">
            <span aria-hidden="true">⚠</span> 驳回原因
          </h2>
          <p className="mt-1 text-xs leading-5 text-stockout-fg">{data.rejectReason}</p>
          <p className="mt-1 text-[11px] text-stockout-fg/80">
            状态已退回「待审批」；申请人可编辑后重新提交，重新提交会清空本原因。
          </p>
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-ink-900">申请信息</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-500">物料 SKU</dt>
              <dd className="font-mono text-sm text-ink-800">{data.sku}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">申请数量</dt>
              <dd className="text-sm tabular-nums text-ink-800">{data.quantity}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">期望到货日期</dt>
              <dd className="text-sm text-ink-800">{formatDate(data.expectedDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">申请人</dt>
              <dd className="text-sm text-ink-800">{data.applicant}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">来源</dt>
              <dd className="text-sm text-ink-800">{REQUEST_SOURCE_LABEL[data.source] ?? data.source}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">版本号</dt>
              <dd className="text-sm tabular-nums text-ink-800">v{data.version}（乐观锁）</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-ink-500">申请理由 / 备注</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-ink-800">{data.reason || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">创建时间</dt>
              <dd className="text-xs text-ink-600">{formatDateTime(data.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">最后更新</dt>
              <dd className="text-xs text-ink-600">{formatDateTime(data.updatedAt)}</dd>
            </div>
          </dl>
        </div>

        <section aria-labelledby="actions-title" className="card p-4">
          <h2 id="actions-title" className="text-sm font-semibold text-ink-900">
            可用操作
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">
            按钮按当前角色与状态显隐；最终以后端状态机校验为准。
          </p>
          <div className="mt-3">
            <RequestActions request={data} />
          </div>
        </section>
      </div>

      {data.status === 'PURCHASING' ? (
        <p className="mt-3 text-xs text-ink-500">
          该申请已生成采购订单，到货入库请前往{' '}
          <Link to={PATHS.orders} className="text-brand-700 underline">
            采购订单
          </Link>
          。
        </p>
      ) : null}

      {data.status === 'COMPLETED' ? (
        <div className="mt-3">
          <EmptyState title="流程已完成" description="到货与完成在同一事务内完成，无后续动作。" />
        </div>
      ) : null}
    </>
  );
}
