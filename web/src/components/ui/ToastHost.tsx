import { useToastStore } from '../../state/toast';

const TONE = {
  success: 'border-normal-bd bg-normal-bg text-normal-fg',
  error: 'border-stockout-bd bg-stockout-bg text-stockout-fg',
  info: 'border-brand-100 bg-brand-50 text-brand-700',
} as const;

const ICON = { success: '✓', error: '✕', info: 'i' } as const;

/** toast 实体 + 同一内容经 aria-live 播报（PRD §7.1「播报」） */
export function ToastHost() {
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:right-4 sm:top-4 sm:items-end sm:px-0">
        {items.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-3 py-2 text-xs shadow-sm ${TONE[item.kind]}`}
          >
            <span aria-hidden="true" className="mt-0.5 font-bold">
              {ICON[item.kind]}
            </span>
            <p className="flex-1 leading-5">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="关闭提示"
              className="tap-target -m-2 flex items-center justify-center px-2 opacity-70"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-region">
        {items.length > 0 ? items[items.length - 1].message : ''}
      </div>
    </>
  );
}
