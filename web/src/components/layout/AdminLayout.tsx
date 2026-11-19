import { NavLink, Outlet } from 'react-router-dom';
import { api, resetDemoData } from '../../api';
import { config } from '../../env';
import { useQuery } from '../../state/useQuery';
import { useSession } from '../../state/session';
import type { Role } from '../../domain/types';
import { PATHS } from '../../routes/paths';
import { UserMenu } from './UserMenu';
import { toastInfo } from '../../state/toast';
import { invalidateAll } from '../../state/query-cache';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  /** 不填表示所有登录角色可见 */
  roles?: Role[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

/** 桌面端导航常量：不含任何 /m 入口之外的内容，结构可审阅 */
export const ADMIN_NAV: NavGroup[] = [
  { title: '概览', items: [{ to: PATHS.dashboard, label: '首页看板' }] },
  { title: '基础数据', items: [{ to: PATHS.materials, label: '辅料档案' }] },
  {
    title: '库存',
    items: [
      { to: PATHS.stock, label: '库存台账', end: true },
      { to: '/admin/stock/inbound', label: '入库' },
      { to: PATHS.stockOutbound, label: '出库' },
      { to: PATHS.stockCount, label: '盘点' },
      { to: PATHS.stockAdjust, label: '库存调整' },
      { to: PATHS.stockMovements, label: '流水明细' },
    ],
  },
  { title: '预警', items: [{ to: PATHS.alerts, label: '低库存预警' }] },
  {
    title: '采购',
    items: [
      { to: PATHS.requests, label: '采购申请' },
      { to: PATHS.orders, label: '采购订单' },
    ],
  },
  { title: '分析', items: [{ to: PATHS.reports('movements'), label: '报表中心' }] },
  { title: '消息', items: [{ to: PATHS.notifications, label: '站内消息' }] },
  {
    title: '后台管理',
    items: [
      { to: PATHS.users, label: '用户管理', roles: ['supervisor'] },
      { to: PATHS.audit, label: '审计日志', roles: ['supervisor'] },
      { to: PATHS.dictionaries, label: '数据字典', roles: ['supervisor'] },
    ],
  },
];

function useUnreadCount() {
  const actor = useSession((state) => state.actor());
  const { data } = useQuery(
    `notifications:unread:${actor}`,
    () => api.notifications.list({ recipient: actor, isRead: 'false', pageSize: 200 }),
    { tags: ['notifications'] },
  );
  return data?.total ?? 0;
}

export function AdminLayout() {
  const unread = useUnreadCount();
  const role = useSession((state) => state.user?.role ?? null);
  const nav = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || (role && item.roles.includes(role))),
  })).filter((group) => group.items.length > 0);

  const onReset = () => {
    resetDemoData();
    invalidateAll();
    toastInfo('已重置为初始演示数据');
  };

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        跳到主内容
      </a>

      <div className="mx-auto flex max-w-page">
        <aside className="hidden w-56 shrink-0 border-r border-line bg-white md:block">
          <div className="flex h-14 items-center border-b border-line px-4">
            <span className="text-sm font-semibold text-ink-900">车间辅料管理</span>
          </div>
          <nav aria-label="后台导航" className="flex flex-col gap-4 px-2 py-3">
            {nav.map((group) => (
              <div key={group.title}>
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {group.title}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          `flex min-h-9 items-center rounded-lg px-2 text-sm ${
                            isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-700 hover:bg-slate-50'
                          }`
                        }
                      >
                        {item.label}
                        {item.to === PATHS.notifications && unread > 0 ? (
                          <span className="ml-auto rounded-full bg-stockout-fg px-1.5 text-[10px] font-semibold text-white">
                            {unread}
                          </span>
                        ) : null}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex h-14 items-center justify-between gap-2 border-b border-line bg-white px-4">
            <div className="flex items-center gap-2 md:hidden">
              <span className="text-sm font-semibold text-ink-900">车间辅料管理</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {config.apiMode === 'mock' ? (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs text-ink-500 underline decoration-dotted hover:text-ink-800"
                >
                  重置演示数据
                </button>
              ) : (
                <span className="rounded-md border border-low-bd bg-low-bg px-2 py-0.5 text-[11px] text-low-fg">
                  联调模式
                </span>
              )}
              <UserMenu />
            </div>
          </header>

          <nav aria-label="后台导航（移动折叠）" className="border-b border-line bg-white px-2 py-2 md:hidden">
            <ul className="flex gap-1 overflow-x-auto">
              {nav.flatMap((g) => g.items).map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `tap-target inline-flex items-center whitespace-nowrap rounded-lg px-3 text-xs ${
                        isActive ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-700'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <main id="main" className="px-4 py-5">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
