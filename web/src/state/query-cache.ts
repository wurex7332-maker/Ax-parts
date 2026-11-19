import { create } from 'zustand';
import type { Tag } from './invalidations';

export interface CacheEntry {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: unknown;
  error?: unknown;
  fetchedAt: number;
  stale: boolean;
  tags: Tag[];
}

interface CacheState {
  entries: Record<string, CacheEntry>;
  version: number;
  setEntry: (key: string, entry: CacheEntry) => void;
  patchEntry: (key: string, patch: Partial<CacheEntry>) => void;
  invalidateTags: (tags: Tag[]) => void;
  invalidateAll: () => void;
  clear: () => void;
}

export const useCacheStore = create<CacheState>((set, get) => ({
  entries: {},
  version: 0,

  setEntry: (key, entry) => set((state) => ({ entries: { ...state.entries, [key]: entry } })),

  patchEntry: (key, patch) =>
    set((state) => {
      const current = state.entries[key];
      if (!current) return state;
      return { entries: { ...state.entries, [key]: { ...current, ...patch } } };
    }),

  invalidateTags: (tags) =>
    set((state) => {
      const next: Record<string, CacheEntry> = {};
      let changed = false;
      for (const [key, entry] of Object.entries(state.entries)) {
        if (entry.tags.some((tag) => tags.includes(tag))) {
          next[key] = { ...entry, stale: true };
          changed = true;
        } else {
          next[key] = entry;
        }
      }
      return changed ? { entries: next, version: state.version + 1 } : state;
    }),

  invalidateAll: () =>
    set((state) => {
      const next: Record<string, CacheEntry> = {};
      for (const [key, entry] of Object.entries(state.entries)) {
        next[key] = { ...entry, stale: true };
      }
      return { entries: next, version: state.version + 1 };
    }),

  clear: () => set({ entries: {}, version: get().version + 1 }),
}));

export function invalidateTags(tags: Tag[]): void {
  useCacheStore.getState().invalidateTags(tags);
}

export function invalidateAll(): void {
  useCacheStore.getState().invalidateAll();
}
