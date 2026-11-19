import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { api } from './api';
import { config } from './env';
import { isPersistent } from './api/mock/db';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('未找到 #root 挂载点');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 联调模式下做一次探活，仅提示不阻塞（避免白屏）
if (config.apiMode === 'http') {
  void api.health().then((result) => {
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        '[Ax-parts] 后端不可达。若为联调，请通过代理访问（npm run dev / npm run preview）；' +
          '直连 3000 端口会因后端未启用 CORS 而失败。',
      );
    }
  });
} else if (!isPersistent()) {
  // eslint-disable-next-line no-console
  console.warn('[Ax-parts] 当前浏览器不可持久化 localStorage，演示数据仅保留在本次会话内。');
}
