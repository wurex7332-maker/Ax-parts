import { requestStatusLabel } from '../../domain/enums';
import { healthOf, suggestedQtyOf } from '../../domain/health';
import type {
  AdjustResult,
  AlertItem,
  AppNotification,
  AuthResult,
  DictionaryItem,
  ArriveResult,
  ConsumptionRankItem,
  CountResult,
  Dashboard,
  Health,
  InboundResult,
  Material,
  MaterialDetail,
  Movement,
  MovementType,
  NotificationType,
  OutboundResult,
  PurchaseOrder,
  PurchaseReport,
  PurchaseRequest,
  PurchaseSuggestion,
  RequestStatus,
  StockRow,
} from '../../domain/types';
import { currentActor, useSession } from '../../state/session';
import { ApiError } from '../errors';
import type {
  AdjustInput,
  AlertQuery,
  ApiPort,
  AuditQuery,
  CreateDictionaryInput,
  CreateUserInput,
  DictionaryQuery,
  LoginInput,
  UpdateDictionaryInput,
  UpdateUserInput,
  UserQuery,
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
import { commit, loadDb, resetDb, type MockDb } from './db';
import { canTransition, transition } from './purchase-machine';
import { matchKeyword, paginate, sortByHealth, withinRange } from './query';
import {
  availableForIssue,
  availableOfCell,
  ensureCell,
  findCell,
  nextMovementNo,
  nowIso,
  skuLocked,
  skuQty,
} from './stock';
import {
  assertEnum,
  assertInt,
  assertNoUnknownFields,
  assertNonEmpty,
} from './validators';

const MATERIAL_FIELDS = [
  'sku',
  'name',
  'category',
  'specModel',
  'brand',
  'unit',
  'location',
  'priceCents',
  'safetyStock',
  'supplier',
  'imageUrl',
] as const;

const UPDATE_FIELDS = [
  'name',
  'category',
  'specModel',
  'brand',
  'unit',
  'location',
  'priceCents',
  'safetyStock',
  'supplier',
  'imageUrl',
] as const;

const INBOUND_FIELDS = ['sku', 'quantity', 'source', 'location', 'purpose', 'batch', 'relatedDocNo'] as const;
const OUTBOUND_FIELDS = ['sku', 'quantity', 'recipient', 'purpose', 'batch', 'location'] as const;
const COUNT_FIELDS = ['sku', 'location', 'actualQty'] as const;
const ADJUST_FIELDS = [
  'sku',
  'type',
  'quantity',
  'location',
  'sourceLocation',
  'targetLocation',
  'purpose',
  'batch',
] as const;
const REQUEST_FIELDS = ['sku', 'quantity', 'expectedDate', 'reason', 'source', 'applicant'] as const;

/** mock 审计：只追加，不提供修改入口 */
function pushAudit(
  db: MockDb,
  action: string,
  resource: string,
  resourceId: string,
  detail?: Record<string, unknown>,
): void {
  db.seq.audit += 1;
  const actor = currentActor();
  db.auditLogs.unshift({
    id: db.seq.audit,
    actor,
    actorRole: useSession.getState().user?.role ?? '',
    action,
    resource,
    resourceId,
    detail: detail ? JSON.stringify(detail) : '',
    createdAt: nowIso(),
  });
}

function assertDictionary(db: MockDb, type: 'CATEGORY' | 'UNIT', value: string, label: string): void {
  const found = db.dictionaries.find((d) => d.type === type && d.value === value && d.enabled);
  if (!found) {
    throw new ApiError('VALIDATION_ERROR', `${label}「${value}」不在启用的数据字典中，请先在数据字典中维护`);
  }
}

function getMaterial(db: MockDb, sku: string): Material {
  const material = db.materials.find((m) => m.sku === sku);
  if (!material) throw new ApiError('MATERIAL_NOT_FOUND', `辅料不存在: ${sku}`);
  return material;
}

function getEnabledMaterial(db: MockDb, sku: string): Material {
  const material = getMaterial(db, sku);
  if (material.status !== 'ENABLED') throw new ApiError('MATERIAL_DISABLED', `辅料已停用: ${sku}`);
  return material;
}

function toDetail(db: MockDb, material: Material): MaterialDetail {
  return { ...material, currentStock: skuQty(db, material.sku) };
}

function pushNotification(
  db: MockDb,
  input: { recipient: string; type: NotificationType; title: string; content: string; relatedDocNo: string },
): void {
  db.seq.notification += 1;
  db.notifications.unshift({
    id: db.seq.notification,
    recipient: input.recipient,
    type: input.type,
    title: input.title,
    content: input.content,
    relatedDocNo: input.relatedDocNo,
    isRead: false,
    createdAt: nowIso(),
  });
}

/** 库存状态恶化时生成提醒（对应 AC-5 的「预警提醒」） */
function notifyHealthDrop(db: MockDb, sku: string, previous: Health, next: Health): void {
  if (next === previous || next === 'NORMAL') return;
  const material = db.materials.find((m) => m.sku === sku);
  if (!material) return;
  const qty = skuQty(db, sku);
  if (next === 'STOCKOUT') {
    pushNotification(db, {
      recipient: 'warehouse',
      type: 'STOCKOUT',
      title: `断料强提醒：${sku}`,
      content: `${material.name} 当前库存 ${qty}，安全库存 ${material.safetyStock}，需立即补货。`,
      relatedDocNo: sku,
    });
    return;
  }
  pushNotification(db, {
    recipient: 'warehouse',
    type: 'ALERT',
    title: `低库存预警：${sku}`,
    content: `${material.name} 当前库存 ${qty}，安全库存 ${material.safetyStock}。`,
    relatedDocNo: sku,
  });
}

function addMovement(
  db: MockDb,
  input: {
    sku: string;
    location: string;
    type: MovementType;
    quantitySigned: number;
    source?: string;
    recipient?: string;
    purpose?: string;
    batch?: string;
    relatedDocNo?: string;
    relatedMovementNo?: string;
  },
): Movement {
  db.seq.movement += 1;
  const movement: Movement = {
    id: db.seq.movement,
    movementNo: nextMovementNo(db),
    sku: input.sku,
    location: input.location,
    type: input.type,
    quantitySigned: input.quantitySigned,
    source: input.source ?? '',
    recipient: input.recipient ?? '',
    purpose: input.purpose ?? '',
    batch: input.batch ?? '',
    operator: currentActor(),
    occurredAt: nowIso(),
    relatedDocNo: input.relatedDocNo ?? '',
    relatedMovementNo: input.relatedMovementNo ?? '',
    createdAt: nowIso(),
  };
  db.movements.push(movement);
  return movement;
}

function collectAlerts(db: MockDb): AlertItem[] {
  const items: AlertItem[] = [];
  for (const material of db.materials) {
    const qty = skuQty(db, material.sku);
    const level = healthOf(qty, material.safetyStock);
    if (level === 'NORMAL') continue;
    const locked = skuLocked(db, material.sku);
    items.push({
      sku: material.sku,
      name: material.name,
      category: material.category,
      unit: material.unit,
      location: material.location,
      currentStock: qty,
      lockedStock: locked,
      availableStock: Math.max(qty - locked, 0),
      safetyStock: material.safetyStock,
      level,
      levelLabel: level === 'STOCKOUT' ? '断料' : '预警',
      suggestedQty: suggestedQtyOf(qty, material.safetyStock),
    });
  }
  return sortByHealth(items);
}

function idempotencyFingerprint(input: OutboundInput): string {
  return JSON.stringify({
    sku: input.sku,
    quantity: input.quantity,
    recipient: input.recipient,
    location: input.location ?? '',
    purpose: input.purpose ?? '',
    batch: input.batch ?? '',
  });
}

function findRequest(db: MockDb, id: number): PurchaseRequest {
  const request = db.requests.find((r) => r.id === id);
  if (!request) throw new ApiError('REQUEST_NOT_FOUND', `采购申请不存在: ${id}`);
  return request;
}

function findOrder(db: MockDb, id: number): PurchaseOrder {
  const order = db.orders.find((o) => o.id === id);
  if (!order) throw new ApiError('ORDER_NOT_FOUND', `采购订单不存在: ${id}`);
  return order;
}

function nextRequestNo(db: MockDb): string {
  db.seq.request += 1;
  return `PR-${String(db.seq.request).padStart(6, '0')}`;
}

function nextOrderNo(db: MockDb): string {
  db.seq.order += 1;
  return `PO-${String(db.seq.order).padStart(6, '0')}`;
}

export function createMockAdapter(): ApiPort & { reset: () => void } {
  return {
    mode: 'mock',

    auth: {
      async login(input: LoginInput): Promise<AuthResult> {
        const db = loadDb();
        const user = db.users.find((u) => u.username === input.username.trim());
        if (!user || user.passwordHash !== `mock:${input.password}`) {
          throw new ApiError('INVALID_CREDENTIALS', '用户名或密码错误');
        }
        if (user.status !== 'ENABLED') {
          throw new ApiError('USER_DISABLED', `用户已停用: ${user.username}`);
        }
        commit((d) => {
          const record = d.users.find((u) => u.username === user.username);
          if (record) record.lastLoginAt = nowIso();
        });
        return {
          token: `mock-token-${user.username}`,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
            status: user.status,
            lastLoginAt: user.lastLoginAt,
          },
        };
      },

      async me() {
        const db = loadDb();
        const username = useSession.getState().user?.username;
        const user = db.users.find((u) => u.username === username);
        if (!user) throw new ApiError('UNAUTHORIZED', '未登录或登录已过期，请重新登录');
        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          status: user.status,
        };
      },

      async logout() {
        return undefined;
      },
    },

    users: {
      async list(query: UserQuery) {
        const db = loadDb();
        const items = db.users
          .filter((u) => (query.role ? u.role === query.role : true))
          .filter((u) => (query.status ? u.status === query.status : true))
          .filter((u) => matchKeyword(query.keyword, u.username, u.displayName))
          .sort((a, b) => a.id - b.id)
          .map((u) => ({
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            role: u.role,
            status: u.status,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            lastLoginAt: u.lastLoginAt,
          }));
        return paginate(items, query);
      },

      async create(input: CreateUserInput) {
        const username = assertNonEmpty(input.username, '用户名').trim();
        const displayName = assertNonEmpty(input.displayName, '姓名');
        if (typeof input.password !== 'string' || input.password.length < 6) {
          throw new ApiError('VALIDATION_ERROR', '密码至少 6 位');
        }
        assertEnum(input.role, ['warehouse', 'supervisor', 'buyer', 'operator'] as const, '角色');

        return commit((db) => {
          if (db.users.some((u) => u.username === username)) {
            throw new ApiError('DUPLICATE_USER', `用户名已存在: ${username}`);
          }
          db.seq.user += 1;
          const at = nowIso();
          const user = {
            id: db.seq.user,
            username,
            passwordHash: `mock:${input.password}`,
            displayName,
            role: input.role,
            status: 'ENABLED' as const,
            createdAt: at,
            updatedAt: at,
            lastLoginAt: '',
          };
          db.users.push(user);
          pushAudit(db, 'USER_CREATE', 'user', username, { role: user.role });
          return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastLoginAt: user.lastLoginAt,
          };
        });
      },

      async update(id: number, patch: UpdateUserInput) {
        return commit((db) => {
          const user = db.users.find((u) => u.id === id);
          if (!user) throw new ApiError('USER_NOT_FOUND', `用户不存在: ${id}`);

          const nextRole = patch.role ?? user.role;
          const nextStatus = patch.status ?? user.status;
          const losingSupervisor =
            user.role === 'supervisor' &&
            user.status === 'ENABLED' &&
            (nextRole !== 'supervisor' || nextStatus !== 'ENABLED');
          if (losingSupervisor) {
            const remaining = db.users.filter(
              (u) => u.role === 'supervisor' && u.status === 'ENABLED' && u.id !== user.id,
            ).length;
            if (remaining === 0) {
              throw new ApiError('VALIDATION_ERROR', '至少需要保留一名启用状态的车间主管');
            }
          }

          user.role = nextRole;
          user.status = nextStatus;
          if (patch.displayName?.trim()) user.displayName = patch.displayName.trim();
          user.updatedAt = nowIso();
          pushAudit(db, 'USER_UPDATE', 'user', user.username, { role: user.role, status: user.status });
          return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
            status: user.status,
          };
        });
      },

      async resetPassword(id: number, password: string) {
        if (typeof password !== 'string' || password.length < 6) {
          throw new ApiError('VALIDATION_ERROR', '密码至少 6 位');
        }
        return commit((db) => {
          const user = db.users.find((u) => u.id === id);
          if (!user) throw new ApiError('USER_NOT_FOUND', `用户不存在: ${id}`);
          user.passwordHash = `mock:${password}`;
          user.updatedAt = nowIso();
          pushAudit(db, 'USER_RESET_PASSWORD', 'user', user.username);
          return { ok: true, username: user.username };
        });
      },

      async changeOwnPassword(password: string) {
        if (typeof password !== 'string' || password.length < 6) {
          throw new ApiError('VALIDATION_ERROR', '密码至少 6 位');
        }
        const username = useSession.getState().user?.username;
        return commit((db) => {
          const user = db.users.find((u) => u.username === username);
          if (!user) throw new ApiError('USER_NOT_FOUND', String(username));
          user.passwordHash = `mock:${password}`;
          user.updatedAt = nowIso();
          return { ok: true };
        });
      },
    },

    audit: {
      async list(query: AuditQuery) {
        const db = loadDb();
        const items = db.auditLogs
          .filter((log) => (query.actor ? log.actor.includes(query.actor) : true))
          .filter((log) => (query.action ? log.action === query.action : true))
          .filter((log) => (query.resource ? log.resource === query.resource : true))
          .filter((log) => withinRange(log.createdAt, query.from, query.to));
        return paginate(items, query);
      },
    },

    dictionaries: {
      async list(query: DictionaryQuery) {
        const db = loadDb();
        const items = db.dictionaries
          .filter((d) => (query.type ? d.type === query.type : true))
          .filter((d) => (query.includeDisabled === '1' ? true : d.enabled))
          .sort((a, b) => a.type.localeCompare(b.type) || a.sortOrder - b.sortOrder || a.id - b.id);
        return paginate(items, query);
      },

      async create(input: CreateDictionaryInput) {
        assertEnum(input.type, ['CATEGORY', 'UNIT'] as const, '类型');
        const value = assertNonEmpty(input.value, '取值').trim();
        return commit((db) => {
          if (db.dictionaries.some((d) => d.type === input.type && d.value === value)) {
            throw new ApiError('DUPLICATE_DICTIONARY', `字典项已存在: ${input.type}/${value}`);
          }
          const at = nowIso();
          const item: DictionaryItem = {
            id: db.dictionaries.length + 1,
            type: input.type,
            value,
            label: (input.label || value).trim(),
            sortOrder: input.sortOrder ?? 100,
            enabled: true,
            createdAt: at,
            updatedAt: at,
          };
          db.dictionaries.push(item);
          pushAudit(db, 'DICTIONARY_CREATE', 'dictionary', String(item.id), {
            type: item.type,
            value: item.value,
          });
          return item;
        });
      },

      async update(id: number, patch: UpdateDictionaryInput) {
        return commit((db) => {
          const item = db.dictionaries.find((d) => d.id === id);
          if (!item) throw new ApiError('DICTIONARY_NOT_FOUND', `字典项不存在: ${id}`);

          if (patch.enabled === false && item.enabled) {
            const used = db.materials.filter((m) =>
              item.type === 'CATEGORY' ? m.category === item.value : m.unit === item.value,
            ).length;
            if (used > 0) {
              throw new ApiError('DICTIONARY_IN_USE', `该字典项仍被物料使用，不能停用: ${item.value}`);
            }
          }

          if (patch.label !== undefined) item.label = patch.label;
          if (patch.sortOrder !== undefined) item.sortOrder = patch.sortOrder;
          if (patch.enabled !== undefined) item.enabled = patch.enabled;
          item.updatedAt = nowIso();
          pushAudit(db, 'DICTIONARY_UPDATE', 'dictionary', String(item.id), {
            type: item.type,
            value: item.value,
            enabled: item.enabled,
          });
          return item;
        });
      },
    },

    async health() {
      return { ok: true };
    },

    materials: {
      async list(query: MaterialQuery) {
        const db = loadDb();
        const filtered = db.materials
          .filter((m) => (query.category ? m.category === query.category : true))
          .filter((m) => (query.status ? m.status === query.status : true))
          .filter((m) => (query.sku ? m.sku === query.sku : true))
          .filter((m) => matchKeyword(query.keyword, m.name, m.sku))
          .sort((a, b) => a.sku.localeCompare(b.sku));
        return paginate(filtered, query);
      },

      async get(sku: string) {
        const db = loadDb();
        return toDetail(db, getMaterial(db, sku));
      },

      async create(input: CreateMaterialInput) {
        assertNoUnknownFields(input as unknown as Record<string, unknown>, MATERIAL_FIELDS);
        const sku = assertNonEmpty(input.sku, 'SKU');
        const name = assertNonEmpty(input.name, '名称');
        const category = assertNonEmpty(input.category, '类别');
        const unit = assertNonEmpty(input.unit, '单位');
        const location = assertNonEmpty(input.location, '存放位置');
        const safetyStock = assertInt(input.safetyStock, '安全库存', 0);
        const priceCents = input.priceCents === undefined ? 0 : assertInt(input.priceCents, '单价', 0);

        return commit((db) => {
          if (db.materials.some((m) => m.sku === sku)) {
            throw new ApiError('DUPLICATE_SKU', `SKU 已存在: ${sku}`);
          }
          assertDictionary(db, 'CATEGORY', category, '类别');
          assertDictionary(db, 'UNIT', unit, '单位');
          const at = nowIso();
          const material: Material = {
            sku,
            name,
            category,
            specModel: input.specModel ?? '',
            brand: input.brand ?? '',
            unit,
            location,
            priceCents,
            safetyStock,
            supplier: input.supplier ?? '',
            imageUrl: input.imageUrl ?? '',
            status: 'ENABLED',
            createdAt: at,
            updatedAt: at,
          };
          db.materials.push(material);
          ensureCell(db, sku, location); // 建档即建 0 库存单元，避免空窗
          pushAudit(db, 'MATERIAL_CREATE', 'material', sku, { name: material.name, category });
          return toDetail(db, material);
        });
      },

      async update(sku: string, patch: UpdateMaterialInput) {
        assertNoUnknownFields(patch as Record<string, unknown>, UPDATE_FIELDS);
        if ('sku' in (patch as Record<string, unknown>)) {
          throw new ApiError('VALIDATION_ERROR', '不允许修改 SKU', { field: 'sku' });
        }
        return commit((db) => {
          const material = getMaterial(db, sku);
          if (patch.name !== undefined) material.name = assertNonEmpty(patch.name, '名称');
          if (patch.category !== undefined) {
            assertDictionary(db, 'CATEGORY', patch.category, '类别');
            material.category = patch.category;
          }
          if (patch.unit !== undefined) {
            assertDictionary(db, 'UNIT', patch.unit, '单位');
            material.unit = patch.unit;
          }
          if (patch.location !== undefined) material.location = assertNonEmpty(patch.location, '存放位置');
          if (patch.priceCents !== undefined) material.priceCents = assertInt(patch.priceCents, '单价', 0);
          if (patch.safetyStock !== undefined) material.safetyStock = assertInt(patch.safetyStock, '安全库存', 0);
          if (patch.specModel !== undefined) material.specModel = patch.specModel;
          if (patch.brand !== undefined) material.brand = patch.brand;
          if (patch.supplier !== undefined) material.supplier = patch.supplier;
          if (patch.imageUrl !== undefined) material.imageUrl = patch.imageUrl;
          material.updatedAt = nowIso();
          pushAudit(db, 'MATERIAL_UPDATE', 'material', sku, { fields: Object.keys(patch) });
          return toDetail(db, material);
        });
      },

      async disable(sku: string) {
        return commit((db) => {
          const material = getMaterial(db, sku);
          material.status = 'DISABLED';
          material.updatedAt = nowIso();
          pushAudit(db, 'MATERIAL_DISABLE', 'material', sku);
          return toDetail(db, material);
        });
      },
    },

    stock: {
      async list(query: StockQuery) {
        const db = loadDb();
        const rows: StockRow[] = db.cells
          .filter((c) => (query.sku ? c.sku === query.sku : true))
          .filter((c) => (query.location ? c.location === query.location : true))
          .map((cell) => {
            const material = db.materials.find((m) => m.sku === cell.sku);
            const total = skuQty(db, cell.sku);
            const safety = material?.safetyStock ?? 0;
            return {
              sku: cell.sku,
              location: cell.location,
              currentStock: cell.qty,
              lockedStock: skuLocked(db, cell.sku),
              availableStock: availableOfCell(db, cell),
              skuCurrentStock: total,
              safetyStock: safety,
              health: healthOf(total, safety),
            };
          })
          .sort((a, b) => a.sku.localeCompare(b.sku) || a.location.localeCompare(b.location));
        return paginate(rows, query);
      },

      async movements(query: MovementQuery) {
        const db = loadDb();
        const filtered = db.movements
          .filter((m) => (query.sku ? m.sku === query.sku : true))
          .filter((m) => (query.type ? m.type === query.type : true))
          .filter((m) => (query.operator ? m.operator.includes(query.operator) : true))
          .filter((m) => withinRange(m.occurredAt, query.from, query.to))
          .sort((a, b) => (a.occurredAt === b.occurredAt ? b.id - a.id : b.occurredAt.localeCompare(a.occurredAt)));
        return paginate(filtered, query);
      },

      async inbound(input: InboundInput): Promise<InboundResult> {
        assertNoUnknownFields(input as unknown as Record<string, unknown>, INBOUND_FIELDS);
        const quantity = assertInt(input.quantity, '数量', 1);
        const source = assertEnum(input.source, ['PURCHASE', 'RETURN'] as const, '入库类型');

        return commit((db) => {
          const material = getEnabledMaterial(db, input.sku);
          const location = input.location || material.location;
          const cell = ensureCell(db, input.sku, location);
          cell.qty += quantity;
          const movement = addMovement(db, {
            sku: input.sku,
            location,
            type: source === 'PURCHASE' ? 'IN_PURCHASE' : 'IN_RETURN',
            quantitySigned: quantity,
            source,
            purpose: input.purpose,
            batch: input.batch,
            relatedDocNo: input.relatedDocNo,
          });
          const currentStock = skuQty(db, input.sku);
          pushAudit(db, 'STOCK_INBOUND', 'stock', input.sku, { quantity, source });
          return { movement, currentStock, health: healthOf(currentStock, material.safetyStock) };
        });
      },

      async outbound(input: OutboundInput, options?: { idempotencyKey?: string }): Promise<OutboundResult> {
        assertNoUnknownFields(input as unknown as Record<string, unknown>, OUTBOUND_FIELDS);
        const quantity = assertInt(input.quantity, '数量', 1);
        assertNonEmpty(input.recipient, '领用人');
        const key = options?.idempotencyKey;

        return commit((db) => {
          if (key) {
            const fp = idempotencyFingerprint(input);
            const existing = db.idempotency[key];
            if (existing) {
              if (existing.fp !== fp) {
                throw new ApiError('IDEMPOTENCY_CONFLICT', `幂等键已被其他请求使用: ${key}`);
              }
              return existing.result as OutboundResult;
            }
          }

          const material = getEnabledMaterial(db, input.sku);
          const available = availableForIssue(db, input.sku);
          if (quantity > available) {
            throw new ApiError('STOCK_INSUFFICIENT', `可用库存不足: ${input.sku}`);
          }
          const location = input.location || material.location;
          const cell = ensureCell(db, input.sku, location);
          if (cell.qty < quantity) {
            throw new ApiError('STOCK_INSUFFICIENT', `可用库存不足: ${input.sku}`);
          }

          const previous = healthOf(skuQty(db, input.sku), material.safetyStock);
          cell.qty -= quantity;
          const movement = addMovement(db, {
            sku: input.sku,
            location,
            type: 'OUT_ISSUE',
            quantitySigned: -quantity,
            source: 'ISSUE',
            recipient: input.recipient,
            purpose: input.purpose,
            batch: input.batch,
          });
          const currentStock = skuQty(db, input.sku);
          const health = healthOf(currentStock, material.safetyStock);
          notifyHealthDrop(db, input.sku, previous, health);

          const result: OutboundResult = {
            movement,
            currentStock,
            availableStock: availableForIssue(db, input.sku),
            health,
          };
          if (key) db.idempotency[key] = { fp: idempotencyFingerprint(input), result };
          pushAudit(db, 'STOCK_OUTBOUND', 'stock', input.sku, { quantity, recipient: input.recipient });
          return result;
        });
      },

      async count(input: CountInput): Promise<CountResult> {
        assertNoUnknownFields(input as unknown as Record<string, unknown>, COUNT_FIELDS);
        const actualQty = assertInt(input.actualQty, '实盘数', 0);
        const location = assertNonEmpty(input.location, '库位');

        return commit((db) => {
          const material = getEnabledMaterial(db, input.sku);
          const cell = findCell(db, input.sku, location);
          const bookStock = cell?.qty ?? 0;
          const difference = actualQty - bookStock;
          const previous = healthOf(skuQty(db, input.sku), material.safetyStock);
          let movement: Movement | null = null;
          let action: 'COUNT_GAIN' | 'COUNT_LOSS' | null = null;

          if (difference !== 0) {
            const target = ensureCell(db, input.sku, location);
            target.qty = actualQty;
            action = difference > 0 ? 'COUNT_GAIN' : 'COUNT_LOSS';
            movement = addMovement(db, {
              sku: input.sku,
              location,
              type: action,
              quantitySigned: difference,
              source: 'COUNT',
              purpose: '库存盘点',
            });
          }

          const currentStock = skuQty(db, input.sku);
          pushAudit(db, 'STOCK_COUNT', 'stock', input.sku, { location, actualQty, difference });
          notifyHealthDrop(db, input.sku, previous, healthOf(currentStock, material.safetyStock));
          return { sku: input.sku, location, bookStock, actualQty, difference, action, movement, currentStock };
        });
      },

      async adjust(input: AdjustInput): Promise<AdjustResult> {
        assertNoUnknownFields(input as unknown as Record<string, unknown>, ADJUST_FIELDS);
        const quantity = assertInt(input.quantity, '数量', 1);
        const type = assertEnum(input.type, ['LOSS', 'TRANSFER'] as const, '调整类型');

        return commit((db) => {
          const material = getEnabledMaterial(db, input.sku);

          if (type === 'LOSS') {
            const location = assertNonEmpty(input.location, '库位');
            const cell = findCell(db, input.sku, location);
            if (!cell || cell.qty < quantity) {
              throw new ApiError('STOCK_INSUFFICIENT', `可用库存不足: ${input.sku}`);
            }
            const previous = healthOf(skuQty(db, input.sku), material.safetyStock);
            cell.qty -= quantity;
            const movement = addMovement(db, {
              sku: input.sku,
              location,
              type: 'ADJUST_LOSS',
              quantitySigned: -quantity,
              source: 'LOSS',
              purpose: input.purpose,
              batch: input.batch,
            });
            const currentStock = skuQty(db, input.sku);
            pushAudit(db, 'STOCK_ADJUST', 'stock', input.sku, { type, quantity });
            notifyHealthDrop(db, input.sku, previous, healthOf(currentStock, material.safetyStock));
            return { type, relatedDocNo: movement.movementNo, movements: [movement], currentStock };
          }

          const sourceLocation = assertNonEmpty(input.sourceLocation, '源库位');
          const targetLocation = assertNonEmpty(input.targetLocation, '目标库位');
          if (sourceLocation === targetLocation) {
            throw new ApiError('VALIDATION_ERROR', '源库位与目标库位不能相同');
          }
          const source = findCell(db, input.sku, sourceLocation);
          if (!source || source.qty < quantity) {
            throw new ApiError('STOCK_INSUFFICIENT', `可用库存不足: ${input.sku}`);
          }
          const docNo = `TRF-${Date.now()}`;
          source.qty -= quantity;
          ensureCell(db, input.sku, targetLocation).qty += quantity;
          const out = addMovement(db, {
            sku: input.sku,
            location: sourceLocation,
            type: 'TRANSFER_OUT',
            quantitySigned: -quantity,
            source: 'TRANSFER',
            purpose: input.purpose,
            relatedDocNo: docNo,
          });
          const inbound = addMovement(db, {
            sku: input.sku,
            location: targetLocation,
            type: 'TRANSFER_IN',
            quantitySigned: quantity,
            source: 'TRANSFER',
            purpose: input.purpose,
            relatedDocNo: docNo,
            relatedMovementNo: out.movementNo,
          });
          pushAudit(db, 'STOCK_ADJUST', 'stock', input.sku, { type, quantity });
          return { type, relatedDocNo: docNo, movements: [out, inbound], currentStock: skuQty(db, input.sku) };
        });
      },
    },

    alerts: {
      async list(query: AlertQuery) {
        const db = loadDb();
        const filtered = collectAlerts(db)
          .filter((a) => (query.sku ? a.sku === query.sku : true))
          .filter((a) => (query.level ? a.level === query.level : true));
        return paginate(filtered, query);
      },

      async generateSuggestions() {
        const db = loadDb();
        const items: PurchaseSuggestion[] = collectAlerts(db).map((a) => ({
          sku: a.sku,
          name: a.name,
          currentStock: a.currentStock,
          safetyStock: a.safetyStock,
          level: a.level,
          suggestedQty: a.suggestedQty,
        }));
        return { items, total: items.length };
      },
    },

    purchase: {
      async listRequests(query: RequestQuery) {
        const db = loadDb();
        const filtered = db.requests
          .filter((r) => (query.status ? r.status === query.status : true))
          .filter((r) => (query.applicant ? r.applicant === query.applicant : true))
          .sort((a, b) => (a.createdAt === b.createdAt ? b.id - a.id : b.createdAt.localeCompare(a.createdAt)));
        return paginate(filtered, query);
      },

      async getRequest(id: number) {
        return findRequest(loadDb(), id);
      },

      async createRequest(input: CreateRequestInput) {
        assertNoUnknownFields(input as unknown as Record<string, unknown>, REQUEST_FIELDS);
        const quantity = assertInt(input.quantity, '数量', 1);
        const expectedDate = assertNonEmpty(input.expectedDate, '期望到货日期');
        const reason = assertNonEmpty(input.reason, '申请理由');
        const source = assertEnum(input.source ?? 'MANUAL', ['ALERT', 'MANUAL'] as const, '来源');

        return commit((db) => {
          const material = getEnabledMaterial(db, input.sku);
          const at = nowIso();
          const request: PurchaseRequest = {
            id: db.seq.request + 1,
            requestNo: nextRequestNo(db),
            sku: input.sku,
            quantity,
            expectedDate,
            reason,
            status: 'PENDING',
            statusLabel: requestStatusLabel('PENDING'),
            applicant: input.applicant || currentActor(),
            source,
            rejectReason: '',
            version: 1,
            createdAt: at,
            updatedAt: at,
          };
          db.requests.push(request);
          pushAudit(db, 'PURCHASE_CREATE', 'purchase_request', request.requestNo, {
            sku: request.sku,
            quantity,
          });
          pushNotification(db, {
            recipient: 'supervisor',
            type: 'ALERT',
            title: `待审批：${request.requestNo}`,
            content: `${request.applicant} 提交采购申请 ${material.name}×${quantity}，等待审批。`,
            relatedDocNo: request.requestNo,
          });
          return request;
        });
      },

      async approve(id: number) {
        return commit((db) => {
          const request = findRequest(db, id);
          transition(request, 'APPROVE', nowIso());
          pushAudit(db, 'PURCHASE_APPROVE', 'purchase_request', request.requestNo);
          pushNotification(db, {
            recipient: request.applicant,
            type: 'APPROVED',
            title: `审批通过：${request.requestNo}`,
            content: '采购申请已通过车间主管审批。',
            relatedDocNo: request.requestNo,
          });
          return request;
        });
      },

      async reject(id: number, body: { reason: string }) {
        if (!body || typeof body.reason !== 'string' || body.reason.trim() === '') {
          throw new ApiError('REJECT_REASON_REQUIRED', '驳回原因必填');
        }
        return commit((db) => {
          const request = findRequest(db, id);
          if (!canTransition(request.status, 'REJECT')) {
            throw new ApiError('ILLEGAL_STATE_TRANSITION', '当前状态不允许驳回');
          }
          request.rejectReason = body.reason.trim();
          transition(request, 'REJECT', nowIso());
          pushAudit(db, 'PURCHASE_REJECT', 'purchase_request', request.requestNo, {
            reason: request.rejectReason,
          });
          pushNotification(db, {
            recipient: request.applicant,
            type: 'REJECTED',
            title: `审批驳回：${request.requestNo}`,
            content: `驳回原因：${request.rejectReason}`,
            relatedDocNo: request.requestNo,
          });
          return request;
        });
      },

      async resubmit(id: number) {
        return commit((db) => {
          const request = findRequest(db, id);
          transition(request, 'RESUBMIT', nowIso());
          pushAudit(db, 'PURCHASE_RESUBMIT', 'purchase_request', request.requestNo);
          return request;
        });
      },

      async close(id: number) {
        return commit((db) => {
          const request = findRequest(db, id);
          if (request.status === 'COMPLETED') return request; // 幂等关闭
          transition(request, 'CLOSE', nowIso());
          return request;
        });
      },

      async listOrders() {
        const db = loadDb();
        const items = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
        return { items, total: items.length };
      },

      async createOrder(input: { requestId: number; quantity?: number }) {
        return commit((db) => {
          const request = findRequest(db, input.requestId);
          if (db.orders.some((o) => o.requestNo === request.requestNo)) {
            throw new ApiError('DUPLICATE_ORDER', `申请已有采购订单: ${request.requestNo}`);
          }
          if (!canTransition(request.status, 'CREATE_ORDER')) {
            throw new ApiError('ILLEGAL_STATE_TRANSITION', `当前状态 ${request.statusLabel} 不允许生成订单`);
          }
          const quantity =
            input.quantity === undefined ? request.quantity : assertInt(input.quantity, '数量', 1);
          transition(request, 'CREATE_ORDER', nowIso());
          const at = nowIso();
          const order: PurchaseOrder = {
            id: db.seq.order + 1,
            orderNo: nextOrderNo(db),
            requestNo: request.requestNo,
            sku: request.sku,
            quantity,
            status: 'OPEN',
            createdBy: currentActor(),
            createdAt: at,
            closedAt: null,
          };
          db.orders.push(order);
          pushAudit(db, 'PURCHASE_ORDER_CREATE', 'purchase_order', order.orderNo, {
            requestNo: order.requestNo,
          });
          return order;
        });
      },

      async arrive(id: number): Promise<ArriveResult> {
        return commit((db) => {
          const order = findOrder(db, id);
          if (order.status !== 'OPEN') {
            throw new ApiError('ORDER_NOT_OPEN', `采购订单未处于 OPEN: ${id}`);
          }
          const request = db.requests.find((r) => r.requestNo === order.requestNo);
          if (!request) throw new ApiError('REQUEST_NOT_FOUND', `采购申请不存在: ${order.requestNo}`);
          const material = getMaterial(db, order.sku);

          const previousHealth = healthOf(skuQty(db, order.sku), material.safetyStock);
          const cell = ensureCell(db, order.sku, material.location);
          cell.qty += order.quantity;
          const movement = addMovement(db, {
            sku: order.sku,
            location: material.location,
            type: 'IN_PURCHASE',
            quantitySigned: order.quantity,
            source: 'PURCHASE',
            relatedDocNo: order.orderNo,
            purpose: '采购到货',
          });
          order.status = 'CLOSED';
          order.closedAt = nowIso();
          transition(request, 'ARRIVE', nowIso());
          const currentStock = skuQty(db, order.sku);
          const health = healthOf(currentStock, material.safetyStock);
          pushAudit(db, 'PURCHASE_ARRIVE', 'purchase_order', order.orderNo, { currentStock });
          pushNotification(db, {
            recipient: 'warehouse',
            type: 'ARRIVED',
            title: `到货入库：${order.orderNo}`,
            content: `${material.name} 到货 ${order.quantity}，当前库存 ${currentStock}。`,
            relatedDocNo: order.orderNo,
          });
          return { order, request, movement, currentStock, previousHealth, health };
        });
      },
    },

    async dashboard(): Promise<Dashboard> {
      const db = loadDb();
      const distribution = { normal: 0, low: 0, stockout: 0 };
      for (const material of db.materials) {
        const level = healthOf(skuQty(db, material.sku), material.safetyStock);
        if (level === 'NORMAL') distribution.normal += 1;
        else if (level === 'LOW') distribution.low += 1;
        else distribution.stockout += 1;
      }
      const total = db.materials.length;
      const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 10000) / 10000);
      const pendingPurchaseCount = db.requests.filter((r) =>
        (['PENDING', 'APPROVED', 'PURCHASING'] as RequestStatus[]).includes(r.status),
      ).length;
      return {
        skuTotal: total,
        alertCount: distribution.low,
        stockoutCount: distribution.stockout,
        pendingPurchaseCount,
        healthDistribution: {
          normal: { count: distribution.normal, percentage: pct(distribution.normal) },
          low: { count: distribution.low, percentage: pct(distribution.low) },
          stockout: { count: distribution.stockout, percentage: pct(distribution.stockout) },
        },
      };
    },

    reports: {
      async movements(query: MovementQuery) {
        const db = loadDb();
        const filtered = db.movements
          .filter((m) => (query.sku ? m.sku === query.sku : true))
          .filter((m) => (query.type ? m.type === query.type : true))
          .filter((m) => withinRange(m.occurredAt, query.from, query.to))
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id - a.id);
        return paginate(filtered, query);
      },

      async consumptionRank(query: ReportQuery) {
        const db = loadDb();
        const map = new Map<string, { consumedQty: number; issueCount: number }>();
        for (const m of db.movements) {
          if (m.type !== 'OUT_ISSUE') continue;
          if (!withinRange(m.occurredAt, query.from, query.to)) continue;
          const entry = map.get(m.sku) ?? { consumedQty: 0, issueCount: 0 };
          entry.consumedQty += Math.abs(m.quantitySigned);
          entry.issueCount += 1;
          map.set(m.sku, entry);
        }
        const items: ConsumptionRankItem[] = [...map.entries()]
          .map(([sku, v]) => {
            const material = db.materials.find((m) => m.sku === sku);
            return {
              sku,
              name: material?.name ?? sku,
              unit: material?.unit ?? '',
              consumedQty: v.consumedQty,
              issueCount: v.issueCount,
            };
          })
          .sort((a, b) => b.consumedQty - a.consumedQty);
        return paginate(items, query);
      },

      async alerts(query: AlertQuery) {
        const db = loadDb();
        const filtered = collectAlerts(db)
          .filter((a) => (query.sku ? a.sku === query.sku : true))
          .filter((a) => (query.level ? a.level === query.level : true));
        return paginate(filtered, query);
      },

      async purchase(): Promise<PurchaseReport> {
        const db = loadDb();
        const statuses: RequestStatus[] = ['PENDING', 'APPROVED', 'PURCHASING', 'ARRIVED', 'COMPLETED'];
        const statusCounts = {} as PurchaseReport['statusCounts'];
        for (const status of statuses) {
          statusCounts[status] = {
            count: db.requests.filter((r) => r.status === status).length,
            label: requestStatusLabel(status),
          };
        }
        return {
          statusCounts,
          totalRequestedQty: db.requests.reduce((sum, r) => sum + r.quantity, 0),
          totalOrderedQty: db.orders.reduce((sum, o) => sum + o.quantity, 0),
          arrivedQty: db.orders.filter((o) => o.status === 'CLOSED').reduce((sum, o) => sum + o.quantity, 0),
          openOrders: db.orders.filter((o) => o.status === 'OPEN').length,
        };
      },
    },

    notifications: {
      async list(query: NotificationQuery) {
        const db = loadDb();
        const wantRead = query.isRead === '1' || query.isRead === 'true';
        const filtered = db.notifications
          .filter((n) => (query.recipient ? n.recipient === query.recipient : true))
          .filter((n) => (query.isRead === undefined ? true : n.isRead === wantRead))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
        return paginate(filtered, query);
      },

      async read(id: number): Promise<AppNotification> {
        return commit((db) => {
          const notification = db.notifications.find((n) => n.id === id);
          if (!notification) throw new ApiError('NOTIFICATION_NOT_FOUND', `站内消息不存在: ${id}`);
          notification.isRead = true;
          return notification;
        });
      },
    },

    reset() {
      resetDb();
    },
  };
}
