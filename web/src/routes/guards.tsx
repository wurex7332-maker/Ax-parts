import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { roleLabelOf, useSession } from '../state/session';
import type { Role } from '../domain/types';
import { PATHS } from './paths';

/** 未登录一律回登录页；登录成功后由登录页按角色跳转。 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const authenticated = useSession((state) => Boolean(state.token && state.user));
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RoleBlockedPage({ roles }: { roles: Role[] }) {
  const user = useSession((state) => state.user);
  const clear = useSession((state) => state.clear);
  const home = user?.role === 'operator' ? PATHS.mobileRoot : PATHS.dashboard;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-ink-900" tabIndex={-1}>
        当前账号无权访问
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        该页面仅限「{roles.map((role) => roleLabelOf(role)).join(' / ')}」使用；当前账号是{' '}
        <strong>{roleLabelOf(user?.role)}</strong>（{user?.username}）。
      </p>
      <p className="mt-1 text-xs text-ink-400">
        如需调整权限，请联系车间主管在「用户管理」中修改角色。
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          to={home}
          className="tap-target inline-flex items-center rounded-lg bg-brand-500 px-4 text-sm text-white"
        >
          返回首页
        </Link>
        <button
          type="button"
          onClick={clear}
          className="tap-target inline-flex items-center rounded-lg border border-line bg-white px-4 text-sm text-ink-700"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}

/** 角色守卫：不满足时渲染说明页而非重定向，避免死循环。 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useSession((state) => state.user?.role ?? null);
  if (!role || !roles.includes(role)) return <RoleBlockedPage roles={roles} />;
  return <>{children}</>;
}
