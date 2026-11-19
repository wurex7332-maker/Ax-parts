import { useState } from 'react';
import { api } from '../../../api';
import { PageHeader } from '../../../components/layout/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { Select, TextInput } from '../../../components/ui/Field';
import { Pagination, TableWrap } from '../../../components/ui/Table';
import { formatDateTime } from '../../../domain/format';
import { AUDIT_ACTION_LABEL } from './labels';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { useQuery } from '../../../state/useQuery';

const PAGE_SIZE = 20;

export function AuditLogPage() {
  useDocumentTitle('审计日志');
  const [page, setPage] = useState(1);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = {
    page,
    pageSize: PAGE_SIZE,
    actor: actor.trim() || undefined,
    action: action || undefined,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
  };

  const { data, error, isLoading, refetch } = useQuery(
    `audit:${JSON.stringify(query)}`,
    () => api.audit.list(query),
    { tags: ['audit'] },
  );

  return (
    <>
      <PageHeader
        title="审计日志"
        description="记录谁在什么时间做了什么。日志由后端在业务成功后写入，不可修改或删除。"
      />

      <div className="card mb-3 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="a-actor" className="mb-1 block text-xs text-ink-500">
            操作人
          </label>
          <TextInput
            id="a-actor"
            value={actor}
            onChange={(event) => {
              setActor(event.target.value);
              setPage(1);
            }}
            placeholder="例如 warehouse"
          />
        </div>
        <div>
          <label htmlFor="a-action" className="mb-1 block text-xs text-ink-500">
            动作
          </label>
          <Select
            id="a-action"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: '全部动作' },
              ...Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        <div>
          <label htmlFor="a-from" className="mb-1 block text-xs text-ink-500">
            起始日期
          </label>
          <TextInput
            id="a-from"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <label htmlFor="a-to" className="mb-1 block text-xs text-ink-500">
            截止日期
          </label>
          <TextInput
            id="a-to"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setActor('');
              setAction('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink-700"
          >
            重置
          </button>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={6} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="暂无审计记录" description="完成一次入库、审批或档案修改后再查看。" />
        ) : (
          <>
            <TableWrap caption={`共 ${data.total} 条记录`}>
              <thead>
                <tr>
                  <th scope="col">时间</th>
                  <th scope="col">操作人</th>
                  <th scope="col">角色</th>
                  <th scope="col">动作</th>
                  <th scope="col">对象</th>
                  <th scope="col">详情</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-xs text-ink-600">{formatDateTime(log.createdAt)}</td>
                    <td className="font-mono text-xs">{log.actor}</td>
                    <td className="text-xs text-ink-500">{log.actorRole || '—'}</td>
                    <td className="text-xs">{AUDIT_ACTION_LABEL[log.action] ?? log.action}</td>
                    <td className="text-xs">
                      <span className="text-ink-500">{log.resource}</span>
                      {log.resourceId ? <span className="ml-1 font-mono">{log.resourceId}</span> : null}
                    </td>
                    <td className="max-w-[280px] truncate text-[11px] text-ink-500" title={log.detail}>
                      {log.detail || '—'}
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
