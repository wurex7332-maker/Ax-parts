export const PATHS = {
  login: '/login',
  adminRoot: '/admin',
  dashboard: '/admin/dashboard',
  materials: '/admin/materials',
  materialNew: '/admin/materials/new',
  materialEdit: (sku: string) => `/admin/materials/${encodeURIComponent(sku)}/edit`,
  stock: '/admin/stock',
  stockInbound: (type?: 'PURCHASE' | 'RETURN') => `/admin/stock/inbound${type ? `?type=${type}` : ''}`,
  stockOutbound: '/admin/stock/outbound',
  stockCount: '/admin/stock/count',
  stockAdjust: '/admin/stock/adjust',
  stockMovements: '/admin/stock/movements',
  alerts: '/admin/alerts',
  requests: '/admin/purchase/requests',
  requestNew: (params?: { from?: 'alert'; sku?: string; qty?: number }) => {
    if (!params?.from) return '/admin/purchase/requests/new';
    const search = new URLSearchParams({ from: params.from });
    if (params.sku) search.set('sku', params.sku);
    if (params.qty !== undefined) search.set('qty', String(params.qty));
    return `/admin/purchase/requests/new?${search.toString()}`;
  },
  requestDetail: (id: number | string) => `/admin/purchase/requests/${id}`,
  orders: '/admin/purchase/orders',
  reports: (tab: string) => `/admin/reports/${tab}`,
  notifications: '/admin/notifications',
  users: '/admin/users',
  audit: '/admin/audit',
  dictionaries: '/admin/dictionaries',
  mobileRoot: '/m',
  scan: '/m/scan',
  mobileSearch: '/m/search',
  approvals: '/m/approvals',
  approvalDetail: (id: number | string) => `/m/approvals/${id}`,
  mobileNotifications: '/m/notifications',
} as const;

export const REPORT_TABS = [
  { key: 'movements', label: '出入库流水' },
  { key: 'consumption', label: '消耗排行' },
  { key: 'alerts', label: '预警清单' },
  { key: 'purchase', label: '采购统计' },
] as const;
