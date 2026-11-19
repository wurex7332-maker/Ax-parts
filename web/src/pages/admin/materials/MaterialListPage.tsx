import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { displayMessageOf, errorCodeOf } from '../../../api/errors';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Badge, EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { Pagination, TableWrap } from '../../../components/ui/Table';
import { Select, TextInput } from '../../../components/ui/Field';
import { CATEGORIES } from '../../../domain/enums';
import { centsToYuanLabel, formatDate } from '../../../domain/format';
import type { Material } from '../../../domain/types';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useMutation } from '../../../state/useMutation';
import { useQuery } from '../../../state/useQuery';
import { toastSuccess } from '../../../state/toast';

const PAGE_SIZE = 20;

export function MaterialListPage() {
  useDocumentTitle('辅料档案');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [pendingDisable, setPendingDisable] = useState<Material | null>(null);

  const query = {
    page,
    pageSize: PAGE_SIZE,
    category: category || undefined,
    keyword: keyword.trim() || undefined,
    status: (status || undefined) as 'ENABLED' | 'DISABLED' | undefined,
  };

  const { data, error, isLoading, refetch } = useQuery(
    `materials:${JSON.stringify(query)}`,
    () => api.materials.list(query),
    { tags: ['materials'] },
  );

  const disable = useMutation('material.disable', (sku: string) => api.materials.disable(sku), {
    onSuccess: (material) => toastSuccess(`已停用：${material.sku} ${material.name}`),
  });

  const onDisable = async () => {
    if (!pendingDisable) return;
    const outcome = await disable.run(pendingDisable.sku);
    setPendingDisable(null);
    if (outcome.ok) void refetch();
  };

  return (
    <>
      <PageHeader
        title="辅料档案"
        description="类别与单位只能取后端允许的枚举值；停用为逻辑停用，不物理删除。列表不显示库存（契约限制），请从「库存台账」查看。"
        actions={
          <Link
            to={PATHS.materialNew}
            className="inline-flex h-10 items-center rounded-lg bg-brand-500 px-4 text-sm font-medium text-white"
          >
            新增辅料
          </Link>
        }
      />

      <div className="card mb-3 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="f-keyword" className="mb-1 block text-xs text-ink-500">
            名称 / SKU
          </label>
          <TextInput
            id="f-keyword"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="输入关键词"
          />
        </div>
        <div>
          <label htmlFor="f-category" className="mb-1 block text-xs text-ink-500">
            类别
          </label>
          <Select
            id="f-category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
          >
            <option value="">全部类别</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="f-status" className="mb-1 block text-xs text-ink-500">
            状态
          </label>
          <Select
            id="f-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">全部状态</option>
            <option value="ENABLED">启用</option>
            <option value="DISABLED">已停用</option>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            onClick={() => {
              setKeyword('');
              setCategory('');
              setStatus('');
              setPage(1);
            }}
          >
            重置筛选
          </Button>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && !data ? <Skeleton rows={6} /> : null}

      {data ? (
        data.items.length === 0 ? (
          <EmptyState
            title="没有匹配的辅料"
            description="调整筛选条件，或新增一条辅料档案。"
            action={
              <Link to={PATHS.materialNew} className="mt-2 text-xs text-brand-700 underline">
                去新增
              </Link>
            }
          />
        ) : (
          <>
            <TableWrap caption={`共 ${data.total} 条档案`}>
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">名称</th>
                  <th scope="col">类别</th>
                  <th scope="col">规格 / 品牌</th>
                  <th scope="col">单位</th>
                  <th scope="col">库位</th>
                  <th scope="col">单价</th>
                  <th scope="col">安全库存</th>
                  <th scope="col">状态</th>
                  <th scope="col">更新时间</th>
                  <th scope="col">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.sku}>
                    <th scope="row" className="font-mono text-xs font-normal text-ink-700">
                      {item.sku}
                    </th>
                    <td>{item.name}</td>
                    <td className="text-xs">{item.category}</td>
                    <td className="text-xs text-ink-500">
                      {[item.specModel, item.brand].filter(Boolean).join(' / ') || '—'}
                    </td>
                    <td className="text-xs">{item.unit}</td>
                    <td className="text-xs">{item.location}</td>
                    <td className="tabular-nums">{centsToYuanLabel(item.priceCents)}</td>
                    <td className="tabular-nums">{item.safetyStock}</td>
                    <td>
                      <Badge tone={item.status === 'ENABLED' ? 'normal' : 'neutral'}>
                        {item.status === 'ENABLED' ? '启用' : '已停用'}
                      </Badge>
                    </td>
                    <td className="text-xs text-ink-500">{formatDate(item.updatedAt)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" onClick={() => navigate(PATHS.materialEdit(item.sku))}>
                          编辑
                        </Button>
                        <Button size="sm" onClick={() => navigate(`${PATHS.stock}?sku=${item.sku}`)}>
                          台账
                        </Button>
                        {item.status === 'ENABLED' ? (
                          <Button size="sm" variant="ghost" onClick={() => setPendingDisable(item)}>
                            停用
                          </Button>
                        ) : null}
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

      <ConfirmDialog
        open={pendingDisable !== null}
        title="停用辅料"
        description={
          pendingDisable
            ? `将停用 ${pendingDisable.sku} ${pendingDisable.name}。停用后该物料不可再入库、出库、盘点、调整或发起采购申请。`
            : ''
        }
        confirmText="确认停用"
        danger
        pending={disable.pending}
        onConfirm={onDisable}
        onCancel={() => setPendingDisable(null)}
      >
        {disable.error ? (
          <p role="alert" className="text-xs text-stockout-fg">
            {errorCodeOf(disable.error) === 'MATERIAL_NOT_FOUND'
              ? '该物料已不存在，请刷新列表'
              : displayMessageOf(disable.error)}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
