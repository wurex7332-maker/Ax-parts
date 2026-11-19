import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSession, type Role } from '../state/session';
import { PATHS } from './paths';

export function RoleBlockedPage({ roles }: { roles: Role[] }) {
  const setRole = useSession((state) => state.setRole);
  const current = useSession((state) => state.role);
  const target = roles[0];

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-ink-900" tabIndex={-1}>
        当前视角无权访问
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        该页面要求角色：{roles.join(' / ')}；当前视角为 <strong>{current}</strong>。
      </p>
      <p className="mt-1 text-xs text-ink-400">
        角色切换仅为演示用的视角收敛，后端不做鉴权，不构成安全边界。
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {target ? (
          <button
            type="button"
            onClick={() => setRole(target)}
            className="tap-target rounded-lg bg-brand-500 px-4 text-sm font-medium text-white"
          >
            切换为 {target}
          </button>
        ) : null}
        <Link
          to={current === 'operator' ? PATHS.mobileRoot : PATHS.dashboard}
          className="tap-target inline-flex items-center rounded-lg border border-line bg-white px-4 text-sm text-ink-700"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}

/** 角色守卫：不满足时渲染说明页而非重定向，避免死循环 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useSession((state) => state.role);
  if (!roles.includes(role)) return <RoleBlockedPage roles={roles} />;
  return <>{children}</>;
}
