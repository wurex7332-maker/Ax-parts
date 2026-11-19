import { useState } from 'react';
import { api } from '../../api';
import { displayMessageOf, errorCodeOf } from '../../api/errors';
import { HealthBadge } from '../../components/health/HealthBadge';
import { Button } from '../../components/ui/Button';
import { EmptyState, Skeleton } from '../../components/ui/Feedback';
import { TextInput } from '../../components/ui/Field';
import type { StockRow } from '../../domain/types';
import { useDocumentTitle } from '../../hooks/useA11y';

export function MobileSearchPage() {
  useDocumentTitle('库存查询');
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const search = async () => {
    const text = keyword.trim();
    if (!text) return;
    setLoading(true);
    setError('');
    try {
      // 先按名称/SKU 找档案，再取台账：/materials 列表不含库存
      const page = await api.materials.list({ keyword: text, pageSize: 20 });
      if (page.items.length === 0) {
        setRows([]);
        setSearched(true);
        return;
      }
      const skus = page.items.map((item) => item.sku);
      const results: StockRow[] = [];
      for (const sku of skus) {
        const stock = await api.stock.list({ sku, pageSize: 50 });
        results.push(...stock.items);
      }
      setRows(results);
      setSearched(true);
    } catch (err) {
      setError(displayMessageOf(err));
      if (errorCodeOf(err) === 'NETWORK_ERROR') setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 tabIndex={-1} className="text-lg font-semibold text-ink-900">
        库存查询
      </h1>

      <div className="card space-y-2 p-3">
        <label htmlFor="mob-search" className="block text-xs font-medium text-ink-700">
          物料 SKU 或名称
        </label>
        <div className="flex gap-2">
          <TextInput
            id="mob-search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void search();
            }}
            placeholder="例如 显示器 或 MON-004"
            autoComplete="off"
          />
          <Button variant="primary" className="tap-target shrink-0" onClick={search} disabled={loading}>
            {loading ? '查询中…' : '查询'}
          </Button>
        </div>
      </div>

      {loading ? <Skeleton rows={3} /> : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-stockout-bg px-3 py-2 text-xs text-stockout-fg">
          {error}
        </p>
      ) : null}

      {searched && !loading && rows.length === 0 ? (
        <EmptyState title="未找到匹配物料" description="换个 SKU 或名称关键词再试。" />
      ) : null}

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={`${row.sku}-${row.location}`} className="rounded-xl border border-line bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-ink-600">{row.sku}</span>
              <HealthBadge health={row.health} currentStock={row.skuCurrentStock} safetyStock={row.safetyStock} />
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-ink-500">库位</dt>
                <dd className="text-ink-800">{row.location || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-500">库位库存</dt>
                <dd className="tabular-nums text-ink-800">{row.currentStock}</dd>
              </div>
              <div>
                <dt className="text-ink-500">合计 / 可用</dt>
                <dd className="tabular-nums text-ink-800">
                  {row.skuCurrentStock} / {row.availableStock}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
