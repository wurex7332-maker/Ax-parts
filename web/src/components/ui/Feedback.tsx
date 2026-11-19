import type { ReactNode } from 'react';
import { displayMessageOf } from '../../api/errors';
import { Button } from './Button';

type Tone = 'neutral' | 'brand' | 'normal' | 'low' | 'stockout';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-ink-700 border-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
  normal: 'bg-normal-bg text-normal-fg border-normal-bd',
  low: 'bg-low-bg text-low-fg border-low-bd',
  stockout: 'bg-stockout-bg text-stockout-fg border-stockout-bd',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {description ? <p className="max-w-md text-xs text-ink-500">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-stockout-bd bg-stockout-bg px-4 py-6 text-center">
      <p className="text-sm font-semibold text-stockout-fg">加载失败</p>
      <p className="mt-1 text-xs text-stockout-fg/90">{displayMessageOf(error)}</p>
      {onRetry ? (
        <div className="mt-3">
          <Button size="sm" onClick={onRetry}>
            重试
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export function Spinner({ label = '加载中' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-500">
      <span
        aria-hidden="true"
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-100 border-t-brand-500"
      />
      {label}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="card p-4" data-tone={tone}>
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-4 text-ink-400">{hint}</p> : null}
    </div>
  );
}
