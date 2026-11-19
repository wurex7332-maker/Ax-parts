import { useState } from 'react';
import { api } from '../../../api';
import { displayMessageOf, errorCodeOf } from '../../../api/errors';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Dialog';
import { Field, TextInput } from '../../../components/ui/Field';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { TableWrap } from '../../../components/ui/Table';
import type { DictionaryItem, DictionaryType } from '../../../domain/types';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { useMutation } from '../../../state/useMutation';
import { useQuery } from '../../../state/useQuery';
import { toastSuccess } from '../../../state/toast';

const TYPE_LABEL: Record<DictionaryType, string> = { CATEGORY: '类别', UNIT: '单位' };

export function DictionaryPage() {
  useDocumentTitle('数据字典');
  const [type, setType] = useState<DictionaryType>('CATEGORY');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ value: '', label: '', sortOrder: '100' });
  const [formError, setFormError] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<DictionaryItem | null>(null);

  const query = { page: 1, pageSize: 200, type, includeDisabled: '1' as const };
  const { data, error, isLoading, refetch } = useQuery(
    `dictionaries:${type}`,
    () => api.dictionaries.list(query),
    { tags: ['dictionaries'] },
  );

  const create = useMutation(
    'dictionary.create',
    () =>
      api.dictionaries.create({
        type,
        value: form.value.trim(),
        label: form.label.trim() || form.value.trim(),
        sortOrder: Number(form.sortOrder) || 100,
      }),
    {
      onSuccess: (item) => {
        toastSuccess(`已新增${TYPE_LABEL[type]}「${item.value}」`);
        setCreateOpen(false);
        setForm({ value: '', label: '', sortOrder: '100' });
      },
    },
  );

  const update = useMutation(
    'dictionary.update',
    (payload: { id: number; patch: { label?: string; sortOrder?: number; enabled?: boolean } }) =>
      api.dictionaries.update(payload.id, payload.patch),
    { onSuccess: () => toastSuccess('已保存') },
  );

  const onCreate = async () => {
    const next: Record<string, string> = {};
    if (!form.value.trim()) next.value = '取值必填';
    setFormError(next);
    if (Object.keys(next).length > 0) return;
    const outcome = await create.run();
    if (!outcome.ok && errorCodeOf(outcome.error) === 'DUPLICATE_DICTIONARY') {
      setFormError({ value: '该取值已存在' });
    }
  };

  return (
    <>
      <PageHeader
        title="数据字典"
        description="维护辅料档案可选用的类别与单位。停用后新档案不能再选该值，已被引用的字典项不能停用。"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            新增{TYPE_LABEL[type]}
          </Button>
        }
      />

      <div className="mb-3 flex gap-2">
        {(['CATEGORY', 'UNIT'] as DictionaryType[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={type === item}
            onClick={() => setType(item)}
            className={`tap-target rounded-lg border px-3 text-xs ${
              type === item ? 'border-brand-500 bg-brand-50 font-medium text-brand-700' : 'border-line bg-white text-ink-700'
            }`}
          >
            {TYPE_LABEL[item]}
          </button>
        ))}
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={5} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState title={`暂无${TYPE_LABEL[type]}`} description="点击右上角新增。" />
        ) : (
          <TableWrap caption={`${TYPE_LABEL[type]}共 ${data.total} 项`}>
            <thead>
              <tr>
                <th scope="col">取值</th>
                <th scope="col">显示名</th>
                <th scope="col">排序</th>
                <th scope="col">状态</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row" className="font-normal text-ink-800">
                    {item.value}
                  </th>
                  <td>{item.label}</td>
                  <td className="tabular-nums text-ink-500">{item.sortOrder}</td>
                  <td>
                    <Badge tone={item.enabled ? 'normal' : 'neutral'}>{item.enabled ? '启用' : '已停用'}</Badge>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" onClick={() => setEditing(item)}>
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={update.pending}
                        onClick={() => update.run({ id: item.id, patch: { enabled: !item.enabled } })}
                      >
                        {item.enabled ? '停用' : '启用'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )
      ) : null}

      {update.error ? (
        <p role="alert" className="mt-2 text-xs text-stockout-fg">
          {errorCodeOf(update.error) === 'DICTIONARY_IN_USE'
            ? '该值仍被物料引用，不能停用。请先调整相关物料。'
            : displayMessageOf(update.error)}
        </p>
      ) : null}

      <Modal
        open={createOpen}
        title={`新增${TYPE_LABEL[type]}`}
        description="取值会写入档案与字典，创建后不建议再改；如需调整请停用后新增。"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button data-autofocus onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={onCreate} disabled={create.pending}>
              确认新增
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="取值" htmlFor="d-value" required error={formError.value} hint={type === 'UNIT' ? '例如：卷' : '例如：劳保用品'}>
            <TextInput
              id="d-value"
              value={form.value}
              onChange={(event) => {
                setForm({ ...form, value: event.target.value });
                setFormError({});
              }}
              invalid={Boolean(formError.value)}
            />
          </Field>
          <Field label="显示名" htmlFor="d-label" hint="留空则与取值一致">
            <TextInput id="d-label" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
          </Field>
          <Field label="排序" htmlFor="d-sort" hint="数字越小越靠前">
            <TextInput
              id="d-sort"
              value={form.sortOrder}
              inputMode="numeric"
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
            />
          </Field>
          {create.error ? (
            <p role="alert" className="text-xs text-stockout-fg">
              {displayMessageOf(create.error)}
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={editing !== null}
        title={`编辑「${editing?.value ?? ''}」`}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button data-autofocus onClick={() => setEditing(null)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!editing) return;
                const outcome = await update.run({
                  id: editing.id,
                  patch: { label: editing.label, sortOrder: editing.sortOrder },
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
            <Field label="显示名" htmlFor="e-label">
              <TextInput
                id="e-label"
                value={editing.label}
                onChange={(event) => setEditing({ ...editing, label: event.target.value })}
              />
            </Field>
            <Field label="排序" htmlFor="e-sort">
              <TextInput
                id="e-sort"
                value={String(editing.sortOrder)}
                inputMode="numeric"
                onChange={(event) =>
                  setEditing({ ...editing, sortOrder: Number(event.target.value) || 100 })
                }
              />
            </Field>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
