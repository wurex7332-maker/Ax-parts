import type {
  AdjustResult,
  AlertItem,
  AppNotification,
  ArriveResult,
  ConsumptionRankItem,
  CountResult,
  Dashboard,
  InboundResult,
  ItemsOnly,
  Material,
  MaterialDetail,
  Movement,
  OutboundResult,
  Page,
  PurchaseOrder,
  PurchaseReport,
  PurchaseRequest,
  PurchaseSuggestion,
  StockRow,
} from '../../domain/types';
import { ApiError } from '../errors';
import type {
  AdjustInput,
  AlertQuery,
  ApiPort,
  CountInput,
  CreateMaterialInput,
  CreateRequestInput,
  InboundInput,
  MaterialQuery,
  MovementQuery,
  NotificationQuery,
  OutboundInput,
  ReportQuery,
  RequestQuery,
  StockQuery,
  UpdateMaterialInput,
} from '../port';
import { request } from './client';
import { ENDPOINTS } from './endpoints';

function toQuery(query: object): Record<string, string | number | undefined> {
  const out: Record<string, string | number | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value as string | number;
  }
  return out;
}

/** 后端字段可能为 null，统一降级为空串，避免表格渲染出 "null" */
function normalizeMaterial(raw: Material): Material {
  return {
    ...raw,
    specModel: raw.specModel ?? '',
    brand: raw.brand ?? '',
    supplier: raw.supplier ?? '',
    imageUrl: raw.imageUrl ?? '',
  };
}

function normalizeRequest(raw: PurchaseRequest): PurchaseRequest {
  return { ...raw, reason: raw.reason ?? '', rejectReason: raw.rejectReason ?? '' };
}

export function createHttpAdapter(): ApiPort {
  async function listRequestsPage(query: RequestQuery): Promise<Page<PurchaseRequest>> {
    const page = await request<Page<PurchaseRequest>>({
      method: 'GET',
      path: ENDPOINTS.requests,
      query: toQuery(query),
    });
    return { ...page, items: (page.items ?? []).map(normalizeRequest) };
  }

  return {
    mode: 'http',

    async health() {
      try {
        await request<{ status: string }>({ method: 'GET', path: ENDPOINTS.health, timeoutMs: 4000 });
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },

    materials: {
      async list(query: MaterialQuery) {
        const page = await request<Page<Material>>({
          method: 'GET',
          path: ENDPOINTS.materials,
          query: toQuery(query),
        });
        return { ...page, items: (page.items ?? []).map(normalizeMaterial) };
      },
      async get(sku: string) {
        const raw = await request<MaterialDetail>({ method: 'GET', path: ENDPOINTS.material(sku) });
        return { ...normalizeMaterial(raw), currentStock: raw.currentStock ?? 0 };
      },
      async create(input: CreateMaterialInput) {
        const raw = await request<MaterialDetail>({
          method: 'POST',
          path: ENDPOINTS.materials,
          body: input,
        });
        return { ...normalizeMaterial(raw), currentStock: raw.currentStock ?? 0 };
      },
      async update(sku: string, patch: UpdateMaterialInput) {
        const raw = await request<MaterialDetail>({
          method: 'PUT',
          path: ENDPOINTS.material(sku),
          body: patch,
        });
        return { ...normalizeMaterial(raw), currentStock: raw.currentStock ?? 0 };
      },
      async disable(sku: string) {
        const raw = await request<MaterialDetail>({
          method: 'POST',
          path: ENDPOINTS.materialDisable(sku),
          body: {},
        });
        return { ...normalizeMaterial(raw), currentStock: raw.currentStock ?? 0 };
      },
    },

    stock: {
      async list(query: StockQuery) {
        return request<Page<StockRow>>({ method: 'GET', path: ENDPOINTS.stock, query: toQuery(query) });
      },
      async movements(query: MovementQuery) {
        return request<Page<Movement>>({ method: 'GET', path: ENDPOINTS.movements, query: toQuery(query) });
      },
      async inbound(input: InboundInput) {
        return request<InboundResult>({ method: 'POST', path: ENDPOINTS.inbound, body: input });
      },
      async outbound(input: OutboundInput, options?: { idempotencyKey?: string }) {
        const headers: Record<string, string> = {};
        if (options?.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
        return request<OutboundResult>({
          method: 'POST',
          path: ENDPOINTS.outbound,
          body: input,
          headers,
        });
      },
      async count(input: CountInput) {
        return request<CountResult>({ method: 'POST', path: ENDPOINTS.count, body: input });
      },
      async adjust(input: AdjustInput) {
        return request<AdjustResult>({ method: 'POST', path: ENDPOINTS.adjust, body: input });
      },
    },

    alerts: {
      async list(query: AlertQuery) {
        return request<Page<AlertItem>>({ method: 'GET', path: ENDPOINTS.alerts, query: toQuery(query) });
      },
      async generateSuggestions() {
        return request<ItemsOnly<PurchaseSuggestion>>({ method: 'POST', path: ENDPOINTS.suggestions, body: {} });
      },
    },

    purchase: {
      listRequests: listRequestsPage,

      /** 后端无详情接口，按列表扫描定位（PRD O-11） */
      async getRequest(id: number) {
        const pageSize = 200;
        for (let page = 1; page <= 10; page += 1) {
          const result = await listRequestsPage({ page, pageSize });
          const hit = result.items.find((r) => r.id === id);
          if (hit) return hit;
          if (result.items.length < pageSize) break;
        }
        throw new ApiError('REQUEST_NOT_FOUND', `采购申请不存在: ${id}`);
      },

      async createRequest(input: CreateRequestInput) {
        const raw = await request<PurchaseRequest>({
          method: 'POST',
          path: ENDPOINTS.requests,
          body: input,
        });
        return normalizeRequest(raw);
      },
      async approve(id: number) {
        const raw = await request<PurchaseRequest>({
          method: 'POST',
          path: ENDPOINTS.requestApprove(id),
          body: {},
        });
        return normalizeRequest(raw);
      },
      async reject(id: number, body: { reason: string }) {
        const raw = await request<PurchaseRequest>({
          method: 'POST',
          path: ENDPOINTS.requestReject(id),
          body,
        });
        return normalizeRequest(raw);
      },
      async resubmit(id: number) {
        const raw = await request<PurchaseRequest>({
          method: 'POST',
          path: ENDPOINTS.requestResubmit(id),
          body: {},
        });
        return normalizeRequest(raw);
      },
      async close(id: number) {
        const response = await request<{ request: PurchaseRequest } | PurchaseRequest>({
          method: 'POST',
          path: ENDPOINTS.requestClose(id),
          body: {},
        });
        const raw = 'request' in response ? response.request : response;
        return normalizeRequest(raw);
      },
      async listOrders() {
        return request<ItemsOnly<PurchaseOrder>>({ method: 'GET', path: ENDPOINTS.orders });
      },
      async createOrder(input: { requestId: number; quantity?: number }) {
        return request<PurchaseOrder>({ method: 'POST', path: ENDPOINTS.orders, body: input });
      },
      async arrive(id: number) {
        return request<ArriveResult>({ method: 'POST', path: ENDPOINTS.orderArrive(id), body: {} });
      },
    },

    async dashboard() {
      return request<Dashboard>({ method: 'GET', path: ENDPOINTS.dashboard });
    },

    reports: {
      async movements(query: MovementQuery) {
        return request<Page<Movement>>({
          method: 'GET',
          path: ENDPOINTS.reportMovements,
          query: toQuery(query),
        });
      },
      async consumptionRank(query: ReportQuery) {
        return request<Page<ConsumptionRankItem>>({
          method: 'GET',
          path: ENDPOINTS.reportConsumption,
          query: toQuery(query),
        });
      },
      async alerts(query: AlertQuery) {
        return request<Page<AlertItem>>({
          method: 'GET',
          path: ENDPOINTS.reportAlerts,
          query: toQuery(query),
        });
      },
      async purchase() {
        return request<PurchaseReport>({ method: 'GET', path: ENDPOINTS.reportPurchase });
      },
    },

    notifications: {
      async list(query: NotificationQuery) {
        return request<Page<AppNotification>>({
          method: 'GET',
          path: ENDPOINTS.notifications,
          query: toQuery(query),
        });
      },
      async read(id: number) {
        return request<AppNotification>({
          method: 'POST',
          path: ENDPOINTS.notificationRead(id),
          body: {},
        });
      },
    },
  };
}
