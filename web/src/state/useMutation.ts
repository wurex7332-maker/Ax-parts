import { useCallback, useState } from 'react';
import { displayMessageOf } from '../api/errors';
import { INVALIDATE, type MutationName } from './invalidations';
import { invalidateTags } from './query-cache';
import { toastError } from './toast';

export type MutationOutcome<T> = { ok: true; data: T } | { ok: false; error: unknown };

export interface MutationOptions<T> {
  /** 成功后的结果播报（不含缓存写入——缓存一律靠失效重拉） */
  onSuccess?: (data: T) => void;
  /** 失败时是否自动 toast（默认 true） */
  toastOnError?: boolean;
}

/**
 * 写操作 hook。成功后按 INVALIDATE 表失效缓存并重拉，
 * 绝不用返回体做本地累加（PRD §6.2「数据刷新」）。
 */
export function useMutation<TArgs extends unknown[], TResult>(
  name: MutationName,
  fn: (...args: TArgs) => Promise<TResult>,
  options: MutationOptions<TResult> = {},
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<MutationOutcome<TResult>> => {
      setPending(true);
      setError(null);
      try {
        const data = await fn(...args);
        invalidateTags(INVALIDATE[name]);
        options.onSuccess?.(data);
        return { ok: true, data };
      } catch (err) {
        setError(err);
        if (options.toastOnError !== false) toastError(displayMessageOf(err));
        return { ok: false, error: err };
      } finally {
        setPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, name],
  );

  return { run, pending, error };
}
