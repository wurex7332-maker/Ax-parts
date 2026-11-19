import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../../api';
import { useQuery } from '../../state/useQuery';
import { useSession } from '../../state/session';
import { PATHS } from '../../routes/paths';
import { RoleSwitch } from './RoleSwitch';

const TITLES: Record<string, string> = {
  [PATHS.mobileRoot]: '辅料领用',
  [PATHS.scan]: '扫码领用',
  [PATHS.mobileSearch]: '库存查询',
  [PATHS.approvals]: '审批',
  [PATHS.mobileNotifications]: '站内消息',
};

/**
 * 移动端导航常量：**结构上不含任何 /admin 路径**（AC-10 的第一重保险，
 * 第二重为 routes 里的角色守卫）。
 */
export const MOBILE_NAV = [
  { to: PATHS.scan, label: '领用', roles: ['operator', 'supervisor'] },
  { to: PATHS.mobileSearch, label: '查询', roles: ['operator', 'supervisor'] },
  { to: PATHS.approvals, label: '审批', roles: ['supervisor'] },
  { to: PATHS.mobileNotifications, label: '消息', roles: ['operator', 'supervisor'] },
] as const;

function useUnreadCount() {
  const actor = useSession((state) => state.actor());
  const { data } = useQuery(
    `notifications:unread:${actor}`,
    () => api.notifications.list({ recipient: actor, isRead: 'false', pageSize: 200 }),
    { tags: ['notifications'] },
  );
  return data?.total ?? 0;
}

export function MobileLayout() {
  const role = useSession((state) => state.role);
  const location = useLocation();
  const unread = useUnreadCount();
  const nav = MOBILE_NAV.filter((item) => (item.roles as readonly string[]).includes(role));

  const title = Object.entries(TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] ?? '辅料领用';

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        跳到主内容
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <span className="text-sm font-semibold text-ink-900">{title}</span>
          <RoleSwitch compact />
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label="移动端主导航"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white"
      >
        <ul className="mx-auto flex max-w-2xl">
          {nav.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `tap-target flex h-14 flex-col items-center justify-center text-xs ${
                    isActive ? 'font-semibold text-brand-700' : 'text-ink-500'
                  }`
                }
              >
                <span>{item.label}</span>
                {item.to === PATHS.mobileNotifications && unread > 0 ? (
                  <span className="mt-0.5 rounded-full bg-stockout-fg px-1.5 text-[10px] font-semibold text-white">
                    {unread} 条未读
                  </span>
                ) : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
