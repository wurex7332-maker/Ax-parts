import { useCallback, useEffect, useRef } from 'react';
import { useCacheStore } from './query-cache';
import type { Tag } from './invalidations';

const inFlight = new Map<string, Promise<unknown>>();

export interface QueryOptions {
  tags?: Tag[];
  enabled?: boolean;
  /** 数据新鲜期（毫秒）。默认 0：切页即校验，符合「后端为权威」 */
  staleTime?: number;
}

export interface QueryResult<T> {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
}

/**
 * 极简查询 hook：按 key 缓存 + 标签失效 + 并发去重。
 * 写操作后由 invalidations 标记 stale，挂载中的查询会自动重拉（不做本地累加）。
 */
export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: QueryOptions = {},
): QueryResult<T> {
  const { tags = [], enabled = true, staleTime = 0 } = options;
  const entry = useCacheStore((state) => state.entries[key]);
  const version = useCacheStore((state) => state.version);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const tagsRef = useRef(tags);
  tagsRef.current = tags;

  const load = useCallback(async () => {
    const store = useCacheStore.getState();
    const current = store.entries[key];
    store.setEntry(key, {
      status: 'loading',
      data: current?.data,
      error: undefined,
      fetchedAt: current?.fetchedAt ?? 0,
      stale: false,
      tags: tagsRef.current,
    });

    let promise = inFlight.get(key);
    if (!promise) {
      promise = fetcherRef.current().finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
    }

    try {
      const data = await (promise as Promise<T>);
      useCacheStore.getState().setEntry(key, {
        status: 'success',
        data,
        error: undefined,
        fetchedAt: Date.now(),
        stale: false,
        tags: tagsRef.current,
      });
    } catch (error) {
      const previous = useCacheStore.getState().entries[key];
      useCacheStore.getState().setEntry(key, {
        status: 'error',
        data: previous?.data,
        error,
        fetchedAt: previous?.fetchedAt ?? 0,
        stale: false,
        tags: tagsRef.current,
      });
    }
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    const current = useCacheStore.getState().entries[key];
    const fresh =
      current &&
      !current.stale &&
      current.status === 'success' &&
      Date.now() - current.fetchedAt < staleTime;
    if (fresh) return;
    void load();
    // version 变化代表有失效发生
  }, [key, enabled, version, staleTime, load]);

  const refetch = useCallback(async () => {
    await load();
  }, [load]);

  return {
    data: entry?.data as T | undefined,
    error: entry?.error,
    isLoading: !entry || (entry.status === 'loading' && entry.data === undefined),
    isFetching: entry?.status === 'loading',
    refetch,
  };
}
