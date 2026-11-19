import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

export { Select } from './Select';

const CONTROL =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}

/** 表单字段容器：label htmlFor + aria-describedby + role=alert 错误（PRD §7.1） */
export function Field({ label, htmlFor, required, hint, error, children, className = '' }: FieldProps) {
  const hintId = hint ? `${htmlFor ?? label}-hint` : undefined;
  const errorId = error ? `${htmlFor ?? label}-error` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink-700">
        {label}
        {required ? (
          <span className="ml-0.5 text-stockout-fg" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only">（必填）</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1 text-xs font-medium text-stockout-fg">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/** 生成可访问性所需的 aria 属性组合 */
export function controlA11y(htmlFor: string, hint?: string, error?: string) {
  const describedBy = [hint ? `${htmlFor}-hint` : '', error ? `${htmlFor}-error` : ''].filter(Boolean).join(' ');
  return {
    id: htmlFor,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  } as const;
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className = '', invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      {...rest}
      aria-invalid={invalid || rest['aria-invalid'] || undefined}
      className={`${CONTROL} ${invalid ? 'border-stockout-bd' : ''} ${className}`}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', rows = 3, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} {...rest} className={`${CONTROL} ${className}`} />;
  },
);

export interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  min?: number;
  max?: number;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { className = '', invalid, min, max, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      {...rest}
      aria-invalid={invalid || undefined}
      className={`${CONTROL} ${invalid ? 'border-stockout-bd' : ''} ${className}`}
    />
  );
});

/** 仅供需要唯一 id 的场景使用 */
export function useFieldId(prefix: string): string {
  const id = useId();
  return `${prefix}-${id.replace(/:/g, '')}`;
}
