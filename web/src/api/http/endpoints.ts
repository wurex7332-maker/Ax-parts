/**
 * 路径常量。`/api/v1` 是逐条写死在后端 controller 里的（无全局前缀），
 * 因此这里直接包含前缀，不再另外拼接。
 */
export const API_PREFIX = '/api/v1';

export const ENDPOINTS = {
  health: '/health',
  materials: `${API_PREFIX}/materials`,
  material: (sku: string) => `${API_PREFIX}/materials/${encodeURIComponent(sku)}`,
  materialDisable: (sku: string) => `${API_PREFIX}/materials/${encodeURIComponent(sku)}/disable`,
  stock: `${API_PREFIX}/stock`,
  movements: `${API_PREFIX}/stock/movements`,
  inbound: `${API_PREFIX}/stock/inbound`,
  outbound: `${API_PREFIX}/stock/outbound`,
  count: `${API_PREFIX}/stock/count`,
  adjust: `${API_PREFIX}/stock/adjust`,
  alerts: `${API_PREFIX}/alerts`,
  suggestions: `${API_PREFIX}/alerts/generate-suggestions`,
  requests: `${API_PREFIX}/purchase/requests`,
  requestApprove: (id: number) => `${API_PREFIX}/purchase/requests/${id}/approve`,
  requestReject: (id: number) => `${API_PREFIX}/purchase/requests/${id}/reject`,
  requestResubmit: (id: number) => `${API_PREFIX}/purchase/requests/${id}/resubmit`,
  requestClose: (id: number) => `${API_PREFIX}/purchase/requests/${id}/close`,
  orders: `${API_PREFIX}/purchase/orders`,
  orderArrive: (id: number) => `${API_PREFIX}/purchase/orders/${id}/arrive`,
  dashboard: `${API_PREFIX}/dashboard`,
  reportMovements: `${API_PREFIX}/reports/movements`,
  reportConsumption: `${API_PREFIX}/reports/consumption-rank`,
  reportAlerts: `${API_PREFIX}/reports/alerts`,
  reportPurchase: `${API_PREFIX}/reports/purchase`,
  notifications: `${API_PREFIX}/notifications`,
  notificationRead: (id: number) => `${API_PREFIX}/notifications/${id}/read`,
} as const;

export type Query = Record<string, string | number | undefined | null>;
