import { create } from 'zustand';

interface AnnounceState {
  message: string;
  announce: (message: string) => void;
}

export const useAnnounceStore = create<AnnounceState>((set) => ({
  message: '',
  announce: (message) => set({ message }),
}));

/** 结果播报：屏幕阅读器可感知，视觉上不可见（PRD §7.1） */
export function announce(message: string): void {
  useAnnounceStore.getState().announce(message);
}

export function Announcer() {
  const message = useAnnounceStore((state) => state.message);
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="announcer">
      {message}
    </div>
  );
}
