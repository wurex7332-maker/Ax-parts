import { HEALTH_RANK } from '../../domain/health';
import type { Health, Page } from '../../domain/types';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../port';

export function normalizePaging(query: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
} {
  const page = Number.isFinite(query.page) && (query.page as number) >= 1 ? Math.floor(query.page as number) : 1;
  const raw = Number.isFinite(query.pageSize) ? Math.floor(query.pageSize as number) : PAGE_SIZE_DEFAULT;
  const pageSize = Math.min(Math.max(raw, 1), PAGE_SIZE_MAX);
  return { page, pageSize };
}

/** 内存分页，返回结构与后端的 Paged<T> 完全一致 */
export function paginate<T>(items: T[], query: { page?: number; pageSize?: number }): Page<T> {
  const { page, pageSize } = normalizePaging(query);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

/** keyword 模糊匹配 name 或 sku（后端行为） */
export function matchKeyword(keyword: string | undefined, ...fields: (string | undefined)[]): boolean {
  if (!keyword) return true;
  const k = keyword.trim().toLowerCase();
  if (!k) return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(k));
}

/** 断料优先、同级按缺口降序，与后端一致 */
export function sortByHealth<T extends { level: Health; currentStock: number; safetyStock: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const rank = HEALTH_RANK[a.level] - HEALTH_RANK[b.level];
    if (rank !== 0) return rank;
    const deficitA = a.safetyStock - a.currentStock;
    const deficitB = b.safetyStock - b.currentStock;
    if (deficitA !== deficitB) return deficitB - deficitA;
    return 0;
  });
}

export function isIsoLike(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

/** 后端以字符串比较 occurred_at，因此非 ISO 输入会静默失效；前端始终传 ISO。 */
export function withinRange(iso: string, from?: string, to?: string): boolean {
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}
