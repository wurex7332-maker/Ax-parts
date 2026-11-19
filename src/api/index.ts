import { config } from '../env';
import { createHttpAdapter } from './http/http-adapter';
import { createMockAdapter } from './mock/mock-adapter';
import type { ApiPort } from './port';

const mockAdapter = createMockAdapter();

export const api: ApiPort = config.apiMode === 'http' ? createHttpAdapter() : mockAdapter;

/** 仅 mock 模式可用：重置演示数据（供验收反复演练 AC-2 / AC-4） */
export function resetDemoData(): void {
  if (config.apiMode === 'mock') mockAdapter.reset();
}

export { config };
export type { ApiPort };
