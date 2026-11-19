import { ApiError } from '../errors';
import { currentToken, useSession } from '../../state/session';
import type { Query } from './endpoints';

const DEFAULT_TIMEOUT_MS = 15000;

export function apiBase(): string {
  const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';
  return base.replace(/\/$/, '');
}

function buildUrl(path: string, query?: Query): string {
  const search = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return `${apiBase()}${path}${qs ? `?${qs}` : ''}`;
}

interface RequestInitLike {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  path: string;
  query?: Query;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * 统一请求封装：
 * - 写请求带 X-Actor（后端无鉴权，仅记录操作人）
 * - 出库可带 Idempotency-Key
 * - 错误体无 statusCode，一律以 body.code 归一为 ApiError
 */
export async function request<T>(init: RequestInitLike): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers ?? {}),
  };
  const token = currentToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(init.path, init.query), {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError('NETWORK_ERROR', undefined, error);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401 && !init.path.includes('/auth/login')) {
    // 令牌失效：清空会话并回到登录页，避免后续请求持续 401
    useSession.getState().clear();
    if (!window.location.hash.startsWith('#/login')) {
      window.location.hash = '#/login';
    }
  }

  if (!response.ok) {
    let payload: { code?: string; message?: string; details?: unknown } | null = null;
    try {
      payload = (await response.json()) as { code?: string; message?: string; details?: unknown };
    } catch {
      payload = null;
    }
    const code = (payload?.code as ApiError['code']) || fallbackCode(response.status);
    throw new ApiError(code, payload?.message, payload?.details);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function fallbackCode(status: number): ApiError['code'] {
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 404) return 'UNKNOWN';
  if (status === 409) return 'ILLEGAL_STATE_TRANSITION';
  return 'UNKNOWN';
}
