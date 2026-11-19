import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { displayMessageOf, errorCodeOf } from '../api/errors';
import { Button } from '../components/ui/Button';
import { Field, TextInput } from '../components/ui/Field';
import { config } from '../env';
import { useDocumentTitle } from '../hooks/useA11y';
import { PATHS } from '../routes/paths';
import { useSession } from '../state/session';
import { announce } from '../components/a11y/Announcer';

const DEMO_ACCOUNTS = [
  { username: 'supervisor', label: '车间主管（含用户管理与审计）' },
  { username: 'warehouse', label: '库管员' },
  { username: 'purchaser', label: '采购员' },
  { username: 'operator', label: '领用人员' },
];

export function LoginPage() {
  useDocumentTitle('登录');
  const navigate = useNavigate();
  const setAuth = useSession((state) => state.setAuth);
  const authenticated = useSession((state) => Boolean(state.token && state.user));
  const role = useSession((state) => state.user?.role ?? null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  // 已登录时直接回到对应首页，避免重复登录
  if (authenticated) {
    return <Navigate to={role === 'operator' ? PATHS.mobileRoot : PATHS.dashboard} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      document.getElementById('login-username')?.focus();
      return;
    }
    setPending(true);
    setError('');
    try {
      const result = await api.auth.login({ username: username.trim(), password });
      setAuth(result.token, result.user);
      announce(`登录成功，欢迎 ${result.user.displayName}`);
      navigate(result.user.role === 'operator' ? PATHS.mobileRoot : PATHS.dashboard, { replace: true });
    } catch (err) {
      const code = errorCodeOf(err);
      setError(
        code === 'NETWORK_ERROR'
          ? displayMessageOf(err)
          : '用户名或密码错误，或该账号已停用。',
      );
      document.getElementById('login-password')?.focus();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <main className="w-full max-w-md">
        <div className="mb-5 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">Ax-parts</p>
          <h1 tabIndex={-1} className="mt-1 text-xl font-semibold text-ink-900">
            车间辅料管理平台
          </h1>
          <p className="mt-1 text-xs text-ink-500">请使用工号账号登录；账号由车间主管在「用户管理」中创建。</p>
        </div>

        <form onSubmit={onSubmit} noValidate className="card space-y-4 p-5">
          <Field label="用户名" htmlFor="login-username" required>
            <TextInput
              id="login-username"
              value={username}
              autoComplete="username"
              autoFocus
              onChange={(event) => setUsername(event.target.value)}
              placeholder="例如 supervisor"
            />
          </Field>

          <Field label="密码" htmlFor="login-password" required>
            <TextInput
              id="login-password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
            />
          </Field>

          {error ? (
            <p role="alert" className="rounded-lg bg-stockout-bg px-3 py-2 text-xs text-stockout-fg">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" className="h-11 w-full" disabled={pending} aria-busy={pending}>
            {pending ? '登录中…' : '登录'}
          </Button>
        </form>

        <section aria-labelledby="demo-title" className="mt-4 rounded-xl border border-dashed border-line bg-white p-3">
          <h2 id="demo-title" className="text-xs font-semibold text-ink-700">
            演示账号（密码均为 axparts123）
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-ink-600">
            {DEMO_ACCOUNTS.map((item) => (
              <li key={item.username} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUsername(item.username);
                    setPassword('axparts123');
                    setError('');
                  }}
                  className="tap-target rounded-md px-1 text-left font-mono text-brand-700 underline decoration-dotted"
                >
                  {item.username}
                </button>
                <span className="text-ink-500">{item.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-4 text-ink-400">
            点用户名可自动填入。当前数据模式：{config.apiMode === 'mock' ? '本地演示（mock）' : '真实后端（http）'}。
          </p>
        </section>
      </main>
    </div>
  );
}
