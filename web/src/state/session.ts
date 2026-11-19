import { create } from 'zustand';

export type Role = 'warehouse' | 'supervisor' | 'buyer' | 'operator';

export interface RoleMeta {
  value: Role;
  label: string;
  /** 写入请求头 X-Actor 的标识（后端无鉴权，仅用于记录操作人） */
  actor: string;
  desc: string;
}

export const ROLES: RoleMeta[] = [
  { value: 'warehouse', label: '库管员', actor: 'warehouse', desc: '档案、库存、预警、看板' },
  { value: 'supervisor', label: '车间主管', actor: 'supervisor', desc: '审批采购申请（双端）' },
  { value: 'buyer', label: '采购员', actor: 'purchaser', desc: '申请、订单、到货' },
  { value: 'operator', label: '领用人员', actor: 'operator', desc: '扫码领用、查询、消息' },
];

const SESSION_KEY = 'axparts.session';

interface PersistedSession {
  role: Role;
  recipientName: string;
}

function readSession(): PersistedSession {
  const fallback: PersistedSession = { role: 'warehouse', recipientName: '操作员' };
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    const role = ROLES.some((r) => r.value === parsed.role) ? (parsed.role as Role) : fallback.role;
    return { role, recipientName: parsed.recipientName || fallback.recipientName };
  } catch {
    return fallback;
  }
}

interface SessionState extends PersistedSession {
  setRole: (role: Role) => void;
  setRecipientName: (name: string) => void;
  actor: () => string;
  roleLabel: () => string;
}

function persist(state: PersistedSession) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // 忽略：会话不可持久化不影响使用
  }
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.role = state.role;
  }
}

const initial = readSession();
if (typeof document !== 'undefined') document.documentElement.dataset.role = initial.role;

export const useSession = create<SessionState>((set, get) => ({
  ...initial,
  setRole: (role) => {
    set({ role });
    persist({ role, recipientName: get().recipientName });
  },
  setRecipientName: (recipientName) => {
    set({ recipientName });
    persist({ role: get().role, recipientName });
  },
  actor: () => ROLES.find((r) => r.value === get().role)?.actor ?? 'system',
  roleLabel: () => ROLES.find((r) => r.value === get().role)?.label ?? '未知角色',
}));

export function currentActor(): string {
  return useSession.getState().actor();
}

export function currentRole(): Role {
  return useSession.getState().role;
}
