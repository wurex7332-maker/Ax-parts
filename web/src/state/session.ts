import { create } from 'zustand';
import type { AppUser, Role } from '../domain/types';

export type { Role };

export interface RoleMeta {
  value: Role;
  label: string;
  desc: string;
}

export const ROLES: RoleMeta[] = [
  { value: 'warehouse', label: '库管员', desc: '档案、库存、预警、看板' },
  { value: 'supervisor', label: '车间主管', desc: '审批、用户与审计、数据字典' },
  { value: 'buyer', label: '采购员', desc: '申请、订单、到货' },
  { value: 'operator', label: '领用人员', desc: '扫码领用、查询、消息' },
];

export function roleLabelOf(role: Role | null | undefined): string {
  if (!role) return '未登录';
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

const STORAGE_KEY = 'axparts.auth.v1';

interface PersistedAuth {
  token: string;
  user: AppUser;
}

interface SessionState {
  token: string | null;
  user: AppUser | null;
  /** 领用人默认值：扫码/出库时作为 recipient */
  recipientName: string;
  setAuth: (token: string, user: AppUser) => void;
  clear: () => void;
  setRecipientName: (name: string) => void;
  actor: () => string;
  roleLabel: () => string;
  isAuthenticated: () => boolean;
}

function readPersisted(): PersistedAuth | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedAuth>;
    if (!parsed?.token || !parsed?.user?.username) return null;
    return { token: parsed.token, user: parsed.user as AppUser };
  } catch {
    return null;
  }
}

const persisted = readPersisted();

export const useSession = create<SessionState>((set, get) => ({
  token: persisted?.token ?? null,
  user: persisted?.user ?? null,
  recipientName: persisted?.user?.displayName ?? '操作员',

  setAuth: (token, user) => {
    set({ token, user, recipientName: user.displayName || '操作员' });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    } catch {
      // 存储不可用不影响本次会话
    }
  },

  clear: () => {
    set({ token: null, user: null });
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 忽略
    }
  },

  setRecipientName: (recipientName) => set({ recipientName }),

  actor: () => get().user?.username ?? 'system',
  roleLabel: () => roleLabelOf(get().user?.role),
  isAuthenticated: () => Boolean(get().token && get().user),
}));

export function currentActor(): string {
  return useSession.getState().actor();
}

export function currentToken(): string | null {
  return useSession.getState().token;
}

export function currentRole(): Role | null {
  return useSession.getState().user?.role ?? null;
}

export function currentUser(): AppUser | null {
  return useSession.getState().user;
}
