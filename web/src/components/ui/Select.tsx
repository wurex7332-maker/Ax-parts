import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  value: string;
  /** 兼容原生写法：传入 <option value="x">标签</option> 列表 */
  children?: ReactNode;
  /** 也支持直接给 options */
  options?: SelectOption[];
  /** 与原生 select 保持一致的调用方式：event.target.value */
  onChange?: (event: { target: { value: string; name?: string } }) => void;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-label'?: string;
}

function optionsFromChildren(children: ReactNode): SelectOption[] {
  const list: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (el.type !== 'option') return;
    const raw = el.props.value;
    const value = raw === undefined ? String(el.props.children ?? '') : String(raw);
    const label = typeof el.props.children === 'string' ? el.props.children : String(el.props.children ?? value);
    list.push({ value, label, disabled: el.props.disabled });
  });
  return list;
}

/**
 * 自绘下拉选择器。
 *
 * 为什么不用原生 <select>：原生弹出层由浏览器外壳绘制，在嵌入式视图（预览面板、
 * Electron/CEF）里会被绘制到页面左上角并脱离控件。自绘列表的位置完全由 CSS 决定，
 * 在各宿主环境中一致。
 *
 * 可访问性：button[role=combobox] + ul[role=listbox] + aria-activedescendant，
 * 支持 ↑↓/Home/End/Enter/Space/Esc/Tab 与点击外部关闭。
 */
export function Select({
  id,
  value,
  children,
  options,
  onChange,
  name,
  disabled,
  invalid,
  className = '',
  'aria-describedby': describedBy,
  'aria-label': ariaLabel,
}: SelectProps) {
  const autoId = useId();
  const buttonId = id ?? `select-${autoId.replace(/:/g, '')}`;
  const listId = `${buttonId}-listbox`;
  const items = options ?? optionsFromChildren(children);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedIndex = items.findIndex((item) => item.value === value);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : undefined;

  const commit = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item || item.disabled) return;
      onChange?.({ target: { value: item.value, name } });
      setOpen(false);
      setActiveIndex(-1);
      buttonRef.current?.focus();
    },
    [items, name, onChange],
  );

  const openList = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [disabled, selectedIndex]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openList();
        else setActiveIndex((i) => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openList();
        else setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (open) {
          event.preventDefault();
          setActiveIndex(items.length - 1);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!open) openList();
        else commit(activeIndex);
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          setActiveIndex(-1);
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const activeId = open && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm text-ink-900 disabled:cursor-not-allowed disabled:bg-slate-50 ${
          invalid ? 'border-stockout-bd' : 'border-line'
        } ${className}`}
      >
        <span className={`truncate ${selected ? '' : 'text-ink-400'}`}>{selected?.label ?? '请选择'}</span>
        <span aria-hidden="true" className={`text-[10px] text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-auto rounded-lg border border-line bg-white py-1 shadow-lg"
        >
          {items.map((item, index) => {
            const isSelected = item.value === value;
            const isActive = index === activeIndex;
            return (
              <li
                key={`${item.value}-${index}`}
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={item.disabled || undefined}
                onMouseEnter={() => !item.disabled && setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(index)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                  item.disabled
                    ? 'cursor-not-allowed text-ink-400'
                    : isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-800'
                }`}
              >
                <span className="truncate">{item.label}</span>
                {isSelected ? (
                  <span aria-hidden="true" className="text-xs text-brand-700">
                    ✓
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
