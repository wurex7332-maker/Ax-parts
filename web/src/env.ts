export type ApiMode = 'mock' | 'http';

interface AppConfig {
  apiMode: ApiMode;
  apiBase: string;
  appName: string;
}

function readMode(): ApiMode {
  const raw = (import.meta.env.VITE_API_MODE as string | undefined)?.trim().toLowerCase();
  // 缺省即 mock：防止误配导致验收环境白屏（AC-6）
  return raw === 'http' ? 'http' : 'mock';
}

export const config: AppConfig = {
  apiMode: readMode(),
  apiBase: ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/$/, ''),
  appName: '车间辅料管理平台',
};

export const isMock = config.apiMode === 'mock';
