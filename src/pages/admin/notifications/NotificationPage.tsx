import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { PageHeader } from '../../../components/layout/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { Badge } from '../../../components/ui/Feedback';
import { NOTIFICATION_LABEL } from '../../../domain/enums';
import { formatDateTime } from '../../../domain/format';
import type { AppNotification } from '../../../domain/types';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useMutation } from '../../../state/useMutation';
import { useQuery } from '../../../state/useQuery';
import { useSession } from '../../../state/session';
import { toastInfo } from '../../../state/toast';

/** 消息直达规则：PR- 前缀进审批详情，其余进预警页（AC-5） */
async function resolveTarget(notification: AppNotification): Promise<string> {
  const doc = notification.relatedDocNo ?? '';
  if (doc.startsWith('PR-')) {
    try {
      const page = await api.purchase.listRequests({ page: 1, pageSize: 200 });
      const hit = page.items.find((item) => item.requestNo === doc);
      if (hit) return PATHS.requestDetail(hit.id);
    } catch {
      // 回退到列表
    }
    return PATHS.requests;
  }
  if (notification.type === 'ARRIVED') return PATHS.orders;
  return PATHS.alerts;
}

export function NotificationPage() {
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
    const target = await resolveTarget(item);
    if (target === PATHS.alerts) toastInfo('已跳转到预警处理页');
    navigate(target);
  };

  return (
    <>
      <PageHeader
        title="站内消息"
        description="消息按收件人过滤。点击预警类消息直达预警处理页，点击审批类消息直达对应申请详情。"
      />

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={4} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState
            title="暂无消息"
            description={`当前收件人 ${actor} 没有消息。切换角色或完成一次领用/审批后再查看。`}
          />
        ) : (
          <ul className="space-y-2">
            {data.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    item.isRead ? 'border-line bg-white' : 'border-brand-100 bg-brand-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
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
                    <span className="text-sm font-medium text-ink-900">{item.title}</span>
                    {!item.isRead ? (
                      <span className="text-[11px] font-semibold text-stockout-fg">● 未读</span>
                    ) : null}
                    <span className="ml-auto text-[11px] text-ink-400">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-ink-600">{item.content}</p>
                  <p className="mt-1 text-[11px] text-ink-400">关联单据：{item.relatedDocNo || '—'}</p>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </>
  );
}
