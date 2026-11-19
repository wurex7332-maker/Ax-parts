/** 写操作 → 需失效的缓存标签。单一常量表，便于审阅与测试（PRD §6.2「写后重拉」）。 */
export type Tag =
  | 'materials'
  | 'stock'
  | 'movements'
  | 'alerts'
  | 'dashboard'
  | 'reports'
  | 'purchase.requests'
  | 'purchase.orders'
  | 'notifications'
  | 'users'
  | 'audit'
  | 'dictionaries';

export type MutationName =
  | 'material.create'
  | 'material.update'
  | 'material.disable'
  | 'stock.inbound'
  | 'stock.outbound'
  | 'stock.count'
  | 'stock.adjust'
  | 'purchase.createRequest'
  | 'purchase.approve'
  | 'purchase.reject'
  | 'purchase.resubmit'
  | 'purchase.close'
  | 'purchase.createOrder'
  | 'purchase.arrive'
  | 'notification.read'
  | 'user.create'
  | 'user.update'
  | 'user.resetPassword'
  | 'dictionary.create'
  | 'dictionary.update';

export const INVALIDATE: Record<MutationName, Tag[]> = {
  'material.create': ['materials', 'stock', 'alerts', 'dashboard', 'reports'],
  'material.update': ['materials', 'stock', 'alerts', 'dashboard'],
  'material.disable': ['materials', 'stock', 'alerts', 'dashboard'],
  'stock.inbound': ['stock', 'movements', 'alerts', 'dashboard', 'reports', 'notifications'],
  'stock.outbound': ['stock', 'movements', 'alerts', 'dashboard', 'reports', 'notifications'],
  'stock.count': ['stock', 'movements', 'alerts', 'dashboard', 'reports'],
  'stock.adjust': ['stock', 'movements', 'alerts', 'dashboard', 'reports', 'notifications'],
  'purchase.createRequest': ['purchase.requests', 'dashboard', 'notifications', 'reports'],
  'purchase.approve': ['purchase.requests', 'purchase.orders', 'dashboard', 'notifications', 'reports'],
  'purchase.reject': ['purchase.requests', 'dashboard', 'notifications', 'reports'],
  'purchase.resubmit': ['purchase.requests', 'dashboard'],
  'purchase.close': ['purchase.requests', 'dashboard', 'reports'],
  'purchase.createOrder': ['purchase.requests', 'purchase.orders', 'dashboard'],
  'purchase.arrive': [
    'purchase.requests',
    'purchase.orders',
    'stock',
    'movements',
    'alerts',
    'dashboard',
    'reports',
    'notifications',
  ],
  'notification.read': ['notifications'],
  'user.create': ['users', 'audit'],
  'user.update': ['users', 'audit'],
  'user.resetPassword': ['users', 'audit'],
  'dictionary.create': ['dictionaries', 'audit'],
  'dictionary.update': ['dictionaries', 'audit'],
};
