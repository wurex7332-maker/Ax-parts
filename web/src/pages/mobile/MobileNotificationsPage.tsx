import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback';
import { NOTIFICATION_LABEL } from '../../domain/enums';
import { formatDateTime } from '../../domain/format';
import type { AppNotification } from '../../domain/types';
import { useDocumentTitle } from '../../hooks/useA11y';
import { PATHS } from '../../routes/paths';
import { useMutation } from '../../state/useMutation';
import { useQuery } from '../../state/useQuery';
import { useSession } from '../../state/session';

async function resolveTarget(item: AppNotification): Promise<string> {
  const doc = item.relatedDocNo ?? '';
  const isApprovalMessage =
    item.type === 'APPROVED' || item.type === 'REJECTED' || (item.type === 'ALERT' && doc.startsWith('PR-'));
  if (isApprovalMessage && doc.startsWith('PR-')) {
    try {
      const page = await api.purchase.listRequests({ page: 1, pageSize: 200 });
      const hit = page.items.find((request) => request.requestNo === doc);
      if (hit) return PATHS.approvalDetail(hit.id);
    } catch {
      // 回退
    }
    return PATHS.approvals;
  }
  return PATHS.alerts;
}

export function MobileNotificationsPage() {
  useDocumentTitle('站内消息');
  const navigate = useNavigate();
  const actor = useSession((state) => state.actor());

  const { data, error, isLoading, refetch } = useQuery(
    `notifications:list:${actor}`,
    () => api.notifications.list({ recipient: actor, pageSize: 100 }),
    { tags: ['notifications'] },
  );

  const read = useMutation('notification.read', (id: number) => api.notifications.read(id));

  const onOpen = async (item: AppNotification) => {
    if (!item.isRead) await read.run(item.id);
    navigate(await resolveTarget(item));
  };

  return (
    <div className="space-y-3">
      <h1 tabIndex={-1} className="text-lg font-semibold text-ink-900">
        站内消息
      </h1>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={3} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="暂无消息" description={`收件人 ${actor} 暂无消息。`} />
        ) : (
          <ul className="space-y-2">
            {data.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    item.isRead ? 'border-line bg-white' : 'border-brand-100 bg-brand-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        item.type === 'STOCKOUT'
                          ? 'stockout'
                          : item.type === 'REJECTED'
                            ? 'low'
                            : item.type === 'APPROVED' || item.type === 'ARRIVED'
                              ? 'normal'
                              : 'brand'
                      }
                    >
                      {NOTIFICATION_LABEL[item.type] ?? item.type}
                    </Badge>
                    {!item.isRead ? <span className="text-[11px] font-semibold text-stockout-fg">● 未读</span> : null}
                    <span className="ml-auto text-[11px] text-ink-400">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink-900">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-ink-600">{item.content}</p>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
