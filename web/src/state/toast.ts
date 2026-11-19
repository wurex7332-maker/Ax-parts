import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (kind, message) => {
    seq += 1;
    const id = seq;
    set((state) => ({ items: [...state.items, { id, kind, message }] }));
    window.setTimeout(() => {
      set((state) => ({ items: state.items.filter((t) => t.id !== id) }));
    }, kind === 'error' ? 8000 : 4000);
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((t) => t.id !== id) })),
  clear: () => set({ items: [] }),
}));

export function toastSuccess(message: string): void {
  useToastStore.getState().push('success', message);
}

export function toastError(message: string): void {
  useToastStore.getState().push('error', message);
}

export function toastInfo(message: string): void {
  useToastStore.getState().push('info', message);
}
