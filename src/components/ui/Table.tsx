import type { ReactNode } from 'react';
import { Button } from './Button';

/** 表格容器：窄屏横向滚动，避免内容截断（AC-9） */
export function TableWrap({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="table-base">
        {caption ? <caption className="px-3 py-2 text-left text-xs text-ink-500">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const maxPage = Math.max(Math.ceil(total / Math.max(pageSize, 1)), 1);
  return (
    <nav aria-label="分页" className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-ink-500">
      <span>
        共 <strong className="tabular-nums text-ink-800">{total}</strong> 条，第 {page} / {maxPage} 页
      </span>
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={() => onChange(Math.max(page - 1, 1))} disabled={page <= 1}>
          上一页
        </Button>
        <Button size="sm" onClick={() => onChange(Math.min(page + 1, maxPage))} disabled={page >= maxPage}>
          下一页
        </Button>
      </div>
    </nav>
  );
}
