import type {
  AppNotification,
  AuditLog,
  DictionaryItem,
  Material,
  Movement,
  PurchaseOrder,
  PurchaseRequest,
} from '../../domain/types';
import { createSeedDb } from './seed';

export interface StockCell {
  sku: string;
  location: string;
  qty: number;
  locked: number;
}

export interface IdempotencyRecord {
  fp: string;
  result: unknown;
}

/** mock 用户：密码以 mock: 前缀存储，仅用于演示，不做真实加密 */
export interface MockUser {
  id: number;
  username: string;
  passwordHash: string;
  displayName: string;
  role: 'warehouse' | 'supervisor' | 'buyer' | 'operator';
  status: 'ENABLED' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

export interface MockDb {
  schemaVersion: 1;
  revision: number;
  users: MockUser[];
  auditLogs: AuditLog[];
  dictionaries: DictionaryItem[];
  materials: Material[];
  cells: StockCell[];
  movements: Movement[];
  requests: PurchaseRequest[];
  orders: PurchaseOrder[];
  notifications: AppNotification[];
  idempotency: Record<string, IdempotencyRecord>;
  seq: {
    movement: number;
    order: number;
    notification: number;
    request: number;
    user: number;
    audit: number;
  };
  createdAt: string;
}

export const STORAGE_KEY = 'axparts.mock.v1';
const CHANNEL_NAME = 'axparts.mock.revision';

let memoryDb: MockDb | null = null;
let storageAvailable: boolean | null = null;
let channel: BroadcastChannel | null = null;

function canUseStorage(): boolean {
  if (storageAvailable !== null) return storageAvailable;
  try {
    const probe = '__axparts_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  return storageAvailable;
}

export function isPersistent(): boolean {
  return canUseStorage();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 读取数据库副本。每次返回独立对象，调用方随意修改，只有 commit 才落盘。 */
export function loadDb(): MockDb {
  if (storageAvailable === null) canUseStorage();

  if (canUseStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MockDb;
        if (parsed && parsed.schemaVersion === 1) return parsed;
      }
    } catch {
      // 损坏数据按首次启动处理
    }
  } else if (memoryDb) {
    return clone(memoryDb);
  }

  const seeded = createSeedDb();
  persist(seeded, false);
  return clone(seeded);
}

function persist(db: MockDb, bumpRevision: boolean) {
  if (bumpRevision) db.revision += 1;
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      if (bumpRevision) broadcast(db.revision);
    } catch {
      // 配额溢出等：降级为内存态，调用方通过 isPersistent() 提示
      storageAvailable = false;
      memoryDb = clone(db);
    }
  } else {
    memoryDb = clone(db);
  }
}

function broadcast(revision: number) {
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ revision });
  } catch {
    // 静默失败：单标签页下无影响
  }
}

/** 事务式提交：先执行 fn，全部成功后才写入，异常时零副作用。 */
export function commit<T>(fn: (db: MockDb) => T): T {
  const db = loadDb();
  const result = fn(db); // 抛错则直接冒泡，不落盘
  persist(db, true);
  return result;
}

export function currentRevision(): number {
  return loadDb().revision;
}

export function resetDb(): void {
  const seeded = createSeedDb();
  persist(seeded, true);
}

/** 监听其他标签页的写入（单浏览器双标签页演示 AC-4 用） */
export function subscribeRevision(onChange: (revision: number) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  try {
    if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
    const handler = (event: MessageEvent) => {
      const revision = (event.data as { revision?: number } | null)?.revision;
      if (typeof revision === 'number') onChange(revision);
    };
    channel.addEventListener('message', handler);
    return () => channel?.removeEventListener('message', handler);
  } catch {
    return () => undefined;
  }
}
