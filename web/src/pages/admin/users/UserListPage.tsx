import { useState } from 'react';
import { api } from '../../../api';
import { displayMessageOf, errorCodeOf } from '../../../api/errors';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Dialog';
import { Field, Select, TextInput } from '../../../components/ui/Field';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { Pagination, TableWrap } from '../../../components/ui/Table';
import { ROLES } from '../../../state/session';
import { roleLabelOf } from '../../../state/session';
import type { AppUser, Role } from '../../../domain/types';
import { formatDateTime } from '../../../domain/format';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { useMutation } from '../../../state/useMutation';
import { useQuery } from '../../../state/useQuery';
import { toastSuccess } from '../../../state/toast';
import { announce } from '../../../components/a11y/Announcer';

const PAGE_SIZE = 20;

export function UserListPage() {
  useDocumentTitle('用户管理');
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'warehouse' as Role });
  const [formError, setFormError] = useState<Record<string, string>>({});

  const [editing, setEditing] = useState<AppUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const query = {
    page,
    pageSize: PAGE_SIZE,
    keyword: keyword.trim() || undefined,
    role: (role || undefined) as Role | undefined,
    status: (status || undefined) as 'ENABLED' | 'DISABLED' | undefined,
  };

  const { data, error, isLoading, refetch } = useQuery(
    `users:${JSON.stringify(query)}`,
    () => api.users.list(query),
    { tags: ['users'] },
  );

  const create = useMutation('user.create', (input: typeof form) => api.users.create(input), {
    onSuccess: (user) => {
      toastSuccess(`已创建用户 ${user.username}`);
      announce(`用户 ${user.username} 创建成功，角色 ${roleLabelOf(user.role)}`);
      setCreateOpen(false);
      setForm({ username: '', displayName: '', password: '', role: 'warehouse' });
    },
  });

  const update = useMutation(
    'user.update',
    (payload: { id: number; patch: { role?: Role; status?: 'ENABLED' | 'DISABLED' } }) =>
      api.users.update(payload.id, payload.patch),
    { onSuccess: (user) => toastSuccess(`已更新 ${user.username}`) },
  );

  const reset = useMutation(
    'user.resetPassword',
    (payload: { id: number; password: string }) => api.users.resetPassword(payload.id, payload.password),
    { onSuccess: (res) => toastSuccess(`已重置 ${res.username} 的密码`) },
  );

  const onCreate = async () => {
    const next: Record<string, string> = {};
    if (!form.username.trim()) next.username = '用户名必填';
    if (!form.displayName.trim()) next.displayName = '姓名必填';
    if (form.password.length < 6) next.password = '密码至少 6 位';
    setFormError(next);
    if (Object.keys(next).length > 0) return;
    const outcome = await create.run(form);
    if (!outcome.ok && errorCodeOf(outcome.error) === 'DUPLICATE_USER') {
      setFormError({ username: '该用户名已存在' });
    }
  };

  return (
    <>
      <PageHeader
        title="用户管理"
        description="账号由车间主管维护。角色决定可访问的菜单与审批权限；停用后该账号立即无法登录。"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            新增用户
          </Button>
        }
      />

      <div className="card mb-3 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="u-keyword" className="mb-1 block text-xs text-ink-500">
            用户名 / 姓名
          </label>
          <TextInput
            id="u-keyword"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="输入关键词"
          />
        </div>
        <div>
          <label htmlFor="u-role" className="mb-1 block text-xs text-ink-500">
            角色
          </label>
          <Select
            id="u-role"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            options={[{ value: '', label: '全部角色' }, ...ROLES.map((r) => ({ value: r.value, label: r.label }))]}
          />
        </div>
        <div>
          <label htmlFor="u-status" className="mb-1 block text-xs text-ink-500">
            状态
          </label>
          <Select
            id="u-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: '全部状态' },
              { value: 'ENABLED', label: '启用' },
              { value: 'DISABLED', label: '已停用' },
            ]}
          />
        </div>
        <div className="flex items-end">
          <Button
            onClick={() => {
              setKeyword('');
              setRole('');
              setStatus('');
              setPage(1);
            }}
          >
            重置筛选
          </Button>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={5} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState title="没有匹配的用户" description="调整筛选条件，或新增一个账号。" />
        ) : (
          <>
            <TableWrap caption={`共 ${data.total} 个账号`}>
              <thead>
                <tr>
                  <th scope="col">用户名</th>
                  <th scope="col">姓名</th>
                  <th scope="col">角色</th>
                  <th scope="col">状态</th>
                  <th scope="col">最近登录</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr key={user.username}>
                    <th scope="row" className="font-mono text-xs font-normal text-ink-700">
                      {user.username}
                    </th>
                    <td>{user.displayName}</td>
                    <td>
                      <Badge tone="brand">{roleLabelOf(user.role)}</Badge>
                    </td>
                    <td>
                      <Badge tone={user.status === 'DISABLED' ? 'neutral' : 'normal'}>
                        {user.status === 'DISABLED' ? '已停用' : '启用'}
                      </Badge>
                    </td>
                    <td className="text-xs text-ink-500">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" onClick={() => setEditing(user)}>
                          改角色/状态
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setResetTarget(user); setNewPassword(''); }}>
                          重置密码
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
          </>
        )
      ) : null}

      {/* 新增用户 */}
      <Modal
        open={createOpen}
        title="新增用户"
        description="用户名将作为操作人记录在流水与审计日志中，创建后不可修改。"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button data-autofocus onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={onCreate} disabled={create.pending} aria-busy={create.pending}>
              {create.pending ? '创建中…' : '确认创建'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="用户名" htmlFor="new-username" required error={formError.username} hint="建议使用工号，例如 zhangsan">
            <TextInput
              id="new-username"
              value={form.username}
              onChange={(event) => {
                setForm({ ...form, username: event.target.value });
                setFormError({ ...formError, username: '' });
              }}
              invalid={Boolean(formError.username)}
            />
          </Field>
          <Field label="姓名" htmlFor="new-displayName" required error={formError.displayName}>
            <TextInput
              id="new-displayName"
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              invalid={Boolean(formError.displayName)}
            />
          </Field>
          <Field label="初始密码" htmlFor="new-password" required error={formError.password} hint="至少 6 位，创建后请让本人自行修改">
            <TextInput
              id="new-password"
              type="password"
              value={form.password}
              onChange={(event) => {
                setForm({ ...form, password: event.target.value });
                setFormError({ ...formError, password: '' });
              }}
              invalid={Boolean(formError.password)}
            />
          </Field>
          <Field label="角色" htmlFor="new-role" required>
            <Select
              id="new-role"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
              options={ROLES.map((r) => ({ value: r.value, label: `${r.label}（${r.desc}）` }))}
            />
          </Field>
          {create.error && !formError.username ? (
            <p role="alert" className="text-xs text-stockout-fg">
              {displayMessageOf(create.error)}
            </p>
          ) : null}
        </div>
      </Modal>

      {/* 改角色 / 状态 */}
      <Modal
        open={editing !== null}
        title={`调整 ${editing?.username ?? ''}`}
        description="停用后该账号立即无法登录，历史流水保留。系统会阻止停用最后一名车间主管。"
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button data-autofocus onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={update.pending}
              onClick={async () => {
                if (!editing) return;
                const outcome = await update.run({
                  id: editing.id as number,
                  patch: {
                    role: editing.role,
                    status: editing.status === 'DISABLED' ? 'DISABLED' : 'ENABLED',
                  },
                });
                if (outcome.ok) setEditing(null);
              }}
            >
              保存
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="space-y-3">
            <Field label="角色" htmlFor="edit-role">
              <Select
                id="edit-role"
                value={editing.role}
                onChange={(event) => setEditing({ ...editing, role: event.target.value as Role })}
                options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
              />
            </Field>
            <Field label="状态" htmlFor="edit-status">
              <Select
                id="edit-status"
                value={editing.status ?? 'ENABLED'}
                onChange={(event) =>
                  setEditing({ ...editing, status: event.target.value as 'ENABLED' | 'DISABLED' })
                }
                options={[
                  { value: 'ENABLED', label: '启用' },
                  { value: 'DISABLED', label: '停用' },
                ]}
              />
            </Field>
            {update.error ? (
              <p role="alert" className="text-xs text-stockout-fg">
                {displayMessageOf(update.error)}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* 重置密码 */}
      <Modal
        open={resetTarget !== null}
        title={`重置 ${resetTarget?.username ?? ''} 的密码`}
        description="重置后旧密码立即失效，请通过线下方式告知本人。"
        onClose={() => setResetTarget(null)}
        footer={
          <>
            <Button data-autofocus onClick={() => setResetTarget(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              disabled={reset.pending || newPassword.length < 6}
              onClick={async () => {
                if (!resetTarget) return;
                const outcome = await reset.run({ id: resetTarget.id as number, password: newPassword });
                if (outcome.ok) setResetTarget(null);
              }}
            >
              确认重置
            </Button>
          </>
        }
      >
        <Field label="新密码" htmlFor="reset-password" required hint="至少 6 位">
          <TextInput
            id="reset-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            invalid={newPassword.length > 0 && newPassword.length < 6}
          />
        </Field>
        {reset.error ? (
          <p role="alert" className="mt-2 text-xs text-stockout-fg">
            {displayMessageOf(reset.error)}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
