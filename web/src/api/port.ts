/**
 * ApiPort —— 前端与数据源之间的唯一契约面。
 * 组件与状态层只依赖此接口，不感知 mock / http 的差异。
 * 所有类型严格对齐后端实测契约（见 docs/TECH-PLAN.md §4）。
 */
import type {
  AdjustResult,
  AppUser,
  AuditLog,
  AuthResult,
  DictionaryItem,
  DictionaryType,
  Role,
  AdjustType,
  AlertItem,
  AppNotification,
  ArriveResult,
  ConsumptionRankItem,
  CountResult,
  Dashboard,
  Health,
  InboundResult,
  InboundSource,
  ItemsOnly,
  MaterialDetail,
  MaterialStatus,
  Movement,
  MovementType,
  OutboundResult,
  Page,
  Material,
  PurchaseOrder,
  PurchaseReport,
  PurchaseRequest,
  PurchaseSuggestion,
  RequestStatus,
  StockRow,
} from '../domain/types';

export interface MaterialQuery {
  page?: number;
  pageSize?: number;
  category?: string;
  keyword?: string;
  status?: MaterialStatus;
  sku?: string;
}

/** 台账查询：后端仅确认 page/pageSize/sku/location */
export interface StockQuery {
  page?: number;
  pageSize?: number;
  sku?: string;
  location?: string;
}

export interface MovementQuery {
  page?: number;
  pageSize?: number;
  sku?: string;
  type?: MovementType;
  operator?: string;
  from?: string;
  to?: string;
}

export interface AlertQuery {
  page?: number;
  pageSize?: number;
  sku?: string;
  level?: Health;
}

export interface RequestQuery {
  page?: number;
  pageSize?: number;
  status?: RequestStatus;
  applicant?: string;
}

export interface NotificationQuery {
  page?: number;
  pageSize?: number;
  recipient?: string;
  /** 后端按字符串枚举解析，禁止传 boolean */
  isRead?: '0' | '1' | 'true' | 'false';
}

export interface ReportQuery {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface CreateUserInput {
  username: string;
  displayName: string;
  password: string;
  role: Role;
}

export interface UpdateUserInput {
  displayName?: string;
  role?: Role;
  status?: 'ENABLED' | 'DISABLED';
}

export interface UserQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  role?: Role;
  status?: 'ENABLED' | 'DISABLED';
}

export interface AuditQuery {
  page?: number;
  pageSize?: number;
  actor?: string;
  action?: string;
  resource?: string;
  from?: string;
  to?: string;
}

export interface DictionaryQuery {
  page?: number;
  pageSize?: number;
  type?: DictionaryType;
  includeDisabled?: '0' | '1';
}

export interface CreateDictionaryInput {
  type: DictionaryType;
  value: string;
  label: string;
  sortOrder?: number;
}

export interface UpdateDictionaryInput {
  label?: string;
  sortOrder?: number;
  enabled?: boolean;
}

export interface CreateMaterialInput {
  sku: string;
  name: string;
  category: string;
  specModel?: string;
  brand?: string;
  unit: string;
  location: string;
  priceCents?: number;
  safetyStock: number;
  supplier?: string;
  imageUrl?: string;
}

/** 编辑时禁止携带 sku（后端 whitelist 会直接 400） */
export type UpdateMaterialInput = Partial<Omit<CreateMaterialInput, 'sku'>>;

export interface InboundInput {
  sku: string;
  quantity: number;
  source: InboundSource;
  location?: string;
  purpose?: string;
  batch?: string;
  relatedDocNo?: string;
}

export interface OutboundInput {
  sku: string;
  quantity: number;
  recipient: string;
  purpose?: string;
  batch?: string;
  location?: string;
}

export interface CountInput {
  sku: string;
  location: string;
  actualQty: number;
}

export interface AdjustInput {
  sku: string;
  type: AdjustType;
  quantity: number;
  location?: string;
  sourceLocation?: string;
  targetLocation?: string;
  purpose?: string;
  batch?: string;
}

export interface CreateRequestInput {
  sku: string;
  quantity: number;
  expectedDate: string;
  reason: string;
  source?: 'ALERT' | 'MANUAL';
  applicant?: string;
}

export interface ApiPort {
  readonly mode: 'mock' | 'http';
  health(): Promise<{ ok: boolean }>;

  auth: {
    login(input: LoginInput): Promise<AuthResult>;
    me(): Promise<AppUser>;
    logout(): Promise<void>;
  };

  users: {
    list(query: UserQuery): Promise<Page<AppUser>>;
    create(input: CreateUserInput): Promise<AppUser>;
    update(id: number, patch: UpdateUserInput): Promise<AppUser>;
    resetPassword(id: number, password: string): Promise<{ ok: boolean; username: string }>;
    changeOwnPassword(password: string): Promise<{ ok: boolean }>;
  };

  audit: {
    list(query: AuditQuery): Promise<Page<AuditLog>>;
  };

  dictionaries: {
    list(query: DictionaryQuery): Promise<Page<DictionaryItem>>;
    create(input: CreateDictionaryInput): Promise<DictionaryItem>;
    update(id: number, patch: UpdateDictionaryInput): Promise<DictionaryItem>;
  };

  materials: {
    /** 列表项不含 currentStock（后端契约限制），需要库存请查台账 */
    list(query: MaterialQuery): Promise<Page<Material>>;
    get(sku: string): Promise<MaterialDetail>;
    create(input: CreateMaterialInput): Promise<MaterialDetail>;
    update(sku: string, patch: UpdateMaterialInput): Promise<MaterialDetail>;
    disable(sku: string): Promise<MaterialDetail>;
  };

  stock: {
    list(query: StockQuery): Promise<Page<StockRow>>;
    movements(query: MovementQuery): Promise<Page<Movement>>;
    inbound(input: InboundInput): Promise<InboundResult>;
    outbound(input: OutboundInput, options?: { idempotencyKey?: string }): Promise<OutboundResult>;
    count(input: CountInput): Promise<CountResult>;
    adjust(input: AdjustInput): Promise<AdjustResult>;
  };

  alerts: {
    list(query: AlertQuery): Promise<Page<AlertItem>>;
    generateSuggestions(): Promise<ItemsOnly<PurchaseSuggestion>>;
  };

  purchase: {
    listRequests(query: RequestQuery): Promise<Page<PurchaseRequest>>;
    getRequest(id: number): Promise<PurchaseRequest>;
    createRequest(input: CreateRequestInput): Promise<PurchaseRequest>;
    approve(id: number): Promise<PurchaseRequest>;
    reject(id: number, body: { reason: string }): Promise<PurchaseRequest>;
    resubmit(id: number): Promise<PurchaseRequest>;
    close(id: number): Promise<PurchaseRequest>;
    listOrders(): Promise<ItemsOnly<PurchaseOrder>>;
    createOrder(input: { requestId: number; quantity?: number }): Promise<PurchaseOrder>;
    arrive(id: number): Promise<ArriveResult>;
  };

  dashboard(): Promise<Dashboard>;

  reports: {
    movements(query: MovementQuery): Promise<Page<Movement>>;
    consumptionRank(query: ReportQuery): Promise<Page<ConsumptionRankItem>>;
    alerts(query: AlertQuery): Promise<Page<AlertItem>>;
    purchase(): Promise<PurchaseReport>;
  };

  notifications: {
    list(query: NotificationQuery): Promise<Page<AppNotification>>;
    read(id: number): Promise<AppNotification>;
  };
}

export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 200;
