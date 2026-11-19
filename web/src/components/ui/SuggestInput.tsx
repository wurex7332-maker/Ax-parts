import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface SuggestInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** 候选值：来自系统里已有的数据，如已有库位、已有供应商 */
  options: string[];
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-describedby'?: string;
  /** 最多展示多少条候选 */
  maxItems?: number;
}

/**
 * 带候选提示的输入框：既是普通输入（可自由填写），又能在输入时给出已有值。
 *
 * 与 Select 的区别：Select 只能选，SuggestInput 允许填新值——库位、供应商这类
 * 「大部分重复、偶尔新增」的字段用这个更顺手。
 *
 * 可访问性：input[role=combobox] + aria-activedescendant 指向高亮项，
 * 支持 ↑↓ 选择、Enter 确认、Esc 关闭、Tab 离开；候选为 role=listbox/option。
 */
export function SuggestInput({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid,
  disabled,
  className = '',
  'aria-describedby': describedBy,
  maxItems = 8,
}: SuggestInputProps) {
  const autoId = useId();
  const inputId = id ?? `suggest-${autoId.replace(/:/g, '')}`;
  const listId = `${inputId}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /** browse：刚聚焦时展示全部候选；filter：正在输入时按关键字过滤 */
  const [mode, setMode] = useState<'browse' | 'filter'>('browse');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const keyword = value.trim().toLowerCase();
  const filtered = (
    mode === 'browse' ? options : options.filter((item) => item.toLowerCase().includes(keyword))
  )
    .filter((item) => item !== value)
    .slice(0, maxItems);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (event.key === 'Enter') {
      if (open && activeIndex >= 0 && filtered[activeIndex]) {
        event.preventDefault();
        commit(filtered[activeIndex]);
      }
      return;
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }
    if (event.key === 'Tab') setOpen(false);
  };

  const showList = open && filtered.length > 0;
  const activeId = showList && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setMode('filter');
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          setMode('browse');
          setOpen(true);
        }}
        onClick={() => {
          setMode('browse');
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 disabled:bg-slate-50 ${
          invalid ? 'border-stockout-bd' : 'border-line'
        } ${className}`}
      />

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="已有值候选"
          className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg"
        >
          {filtered.map((item, index) => (
            <li
              key={item}
              id={`${listId}-opt-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(item)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === activeIndex ? 'bg-brand-50 text-brand-700' : 'text-ink-800'
              }`}
            >
              {item}
            </li>
          ))}
          <li className="border-t border-line px-3 py-1.5 text-[11px] text-ink-400">
            也可以直接输入新值，不受列表限制
          </li>
        </ul>
      ) : null}
    </div>
  );
}
