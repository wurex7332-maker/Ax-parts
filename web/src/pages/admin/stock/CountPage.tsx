import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import { displayMessageOf } from '../../../api/errors';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { SuggestInput } from '../../../components/ui/SuggestInput';
import { useLocationOptions } from '../../../hooks/useSuggestions';
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui/Feedback';
import { TableWrap } from '../../../components/ui/Table';
import { useDocumentTitle } from '../../../hooks/useA11y';
import { PATHS } from '../../../routes/paths';
import { useQuery } from '../../../state/useQuery';
import { invalidateTags } from '../../../state/query-cache';
import { toastError, toastSuccess } from '../../../state/toast';
import { announce } from '../../../components/a11y/Announcer';

interface RowResult {
  status: 'idle' | 'ok' | 'error';
  message?: string;
}

export function CountPage() {
  useDocumentTitle('库存盘点');
  const [location, setLocation] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const locationOptions = useLocationOptions();

  const { data, error, isLoading, refetch } = useQuery(
    `stock:count:${location}`,
    () => api.stock.list({ location, pageSize: 200 }),
    { tags: ['stock'], enabled: Boolean(location) },
  );

  const rows = data?.items ?? [];

  const diffs = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const row of rows) {
      const raw = actuals[row.sku];
      const value = raw === undefined || raw === '' ? null : Number(raw);
      map[row.sku] = value === null || !Number.isFinite(value) ? null : value - row.currentStock;
    }
    return map;
  }, [rows, actuals]);

  const filled = rows.filter((row) => actuals[row.sku] !== undefined && actuals[row.sku] !== '');

  const submitAll = async () => {
    setRunning(true);
    const next: Record<string, RowResult> = {};
    let success = 0;
    // 后端盘点接口为单条，前端串行逐条过账；失败行不影响已成功行
    for (const row of filled) {
      const actualQty = Number(actuals[row.sku]);
      try {
        const result = await api.stock.count({ sku: row.sku, location, actualQty });
        next[row.sku] = {
          status: 'ok',
          message:
            result.difference === 0
              ? '账实相符，未产生流水'
              : `${result.action === 'COUNT_GAIN' ? '盘盈' : '盘亏'} ${Math.abs(result.difference)}`,
        };
        success += 1;
      } catch (err) {
        next[row.sku] = { status: 'error', message: displayMessageOf(err) };
      }
    }
    setResults(next);
    setRunning(false);
    setConfirmOpen(false);
    invalidateTags(['stock', 'movements', 'alerts', 'dashboard', 'reports']);
    void refetch();
    if (success > 0) {
      toastSuccess(`已过账 ${success} 条盘点记录`);
      announce(`盘点提交完成，成功 ${success} 条`);
    }
    if (success !== filled.length) toastError('部分盘点记录提交失败，请查看行内提示');
  };

  return (
    <>
      <PageHeader
        title="库存盘点"
        description="按库位列出物料与账面数，录入实盘数后逐条过账。后端仅支持单条提交，故这里串行处理，失败行不影响已成功行。"
        breadcrumb={
          <Link to={PATHS.stock} className="underline decoration-dotted">
            库存台账
          </Link>
        }
      />

      <div className="card mb-3 flex flex-wrap items-end gap-2 p-3">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="count-location" className="mb-1 block text-xs text-ink-500">
            库位
          </label>
          <SuggestInput
            id="count-location"
            value={locationInput}
            onChange={setLocationInput}
            options={locationOptions}
            placeholder="例如 A-01（可从已有库位选）"
          />
        </div>
        <Button
          onClick={() => {
            setLocation(locationInput.trim());
            setActuals({});
            setResults({});
          }}
        >
          载入库位物料
        </Button>
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : null}
      {isLoading && location ? <Skeleton rows={4} /> : null}

      {location && data && rows.length === 0 ? (
        <EmptyState title="该库位暂无物料" description="请确认库位编码是否正确。" />
      ) : null}

      {rows.length > 0 ? (
        <>
          <TableWrap caption={`库位 ${location} 共 ${rows.length} 个物料`}>
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">账面数</th>
                <th scope="col">实盘数</th>
                <th scope="col">差异</th>
                <th scope="col">结果</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diff = diffs[row.sku];
                const result = results[row.sku];
                return (
                  <tr key={row.sku}>
                    <th scope="row" className="font-mono text-xs font-normal text-ink-700">
                      {row.sku}
                    </th>
                    <td className="tabular-nums">{row.currentStock}</td>
                    <td>
                      <label htmlFor={`actual-${row.sku}`} className="sr-only">
                        {row.sku} 实盘数
                      </label>
                      <input
                        id={`actual-${row.sku}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={actuals[row.sku] ?? ''}
                        onChange={(event) => setActuals((prev) => ({ ...prev, [row.sku]: event.target.value }))}
                        className="w-24 rounded-lg border border-line px-2 py-1 text-sm tabular-nums"
                        placeholder="—"
                      />
                    </td>
                    <td className={`tabular-nums ${diff ? 'font-medium' : 'text-ink-500'}`}>
                      {diff === null || diff === undefined ? '—' : diff > 0 ? `盘盈 +${diff}` : diff < 0 ? `盘亏 ${diff}` : '持平'}
                    </td>
                    <td className="text-xs">
                      {result?.status === 'ok' ? (
                        <span className="text-normal-fg">{result.message}</span>
                      ) : result?.status === 'error' ? (
                        <span className="text-stockout-fg">{result.message}</span>
                      ) : (
                        <span className="text-ink-400">待提交</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={filled.length === 0 || running}>
              提交盘点（{filled.length} 条）
            </Button>
            <span className="text-xs text-ink-500">未填写实盘数的行不会被提交。</span>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="确认提交盘点"
        description={`将逐条过账 ${filled.length} 条记录。盘盈/盘亏会写入库存流水，差异为 0 的行不产生流水。`}
        confirmText="确认过账"
        pending={running}
        onConfirm={submitAll}
        onCancel={() => setConfirmOpen(false)}
      >
        <ul className="max-h-40 space-y-1 overflow-auto text-xs text-ink-700">
          {filled.map((row) => (
            <li key={row.sku} className="flex justify-between">
              <span className="font-mono">{row.sku}</span>
              <span>
                账面 {row.currentStock} → 实盘 {actuals[row.sku]}
              </span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
    </>
  );
}
