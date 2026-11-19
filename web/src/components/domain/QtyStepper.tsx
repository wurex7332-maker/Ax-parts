import { useId } from 'react';

export interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  invalid?: boolean;
  hint?: string;
  error?: string;
}

/** 数量步进器：± 按钮 44px，支持直接输入，非法值不吞掉用户输入（AC-8） */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  label = '数量',
  invalid,
  hint,
  error,
}: QtyStepperProps) {
  const id = useId();
  const clamp = (v: number) => {
    const lower = Math.max(v, min);
    return max === undefined ? lower : Math.min(lower, max);
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-700">
        {label}
        <span className="ml-0.5 text-stockout-fg" aria-hidden="true">
          *
        </span>
        <span className="sr-only">（必填）</span>
      </label>
      <div className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          aria-label={`${label}减一`}
          disabled={value <= min}
          className="tap-target rounded-lg border border-line bg-white px-3 text-base text-ink-700 disabled:opacity-40"
        >
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ''}
          onChange={(event) => {
            const next = Number(event.target.value);
            onChange(Number.isFinite(next) ? next : min);
          }}
          onBlur={() => onChange(clamp(value))}
          aria-invalid={invalid || undefined}
          aria-describedby={[hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined}
          className={`w-20 rounded-lg border bg-white px-2 py-2 text-center text-sm tabular-nums ${
            invalid ? 'border-stockout-bd' : 'border-line'
          }`}
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          aria-label={`${label}加一`}
          disabled={max !== undefined && value >= max}
          className="tap-target rounded-lg border border-line bg-white px-3 text-base text-ink-700 disabled:opacity-40"
        >
          +
        </button>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs font-medium text-stockout-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
