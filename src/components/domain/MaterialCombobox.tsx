import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '../../api';
import type { Material } from '../../domain/types';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { HealthBadge } from '../health/HealthBadge';
import { Badge } from '../ui/Feedback';

export interface MaterialComboboxProps {
  onSelect: (material: Material) => void;
  label?: string;
  placeholder?: string;
  /** 外部带入的关键词（如扫码结果） */
  initialKeyword?: string;
}

/**
 * 可搜索物料选择器：输入 SKU/名称 → 防抖查询（pageSize 8）。
 * 选中即回填，属于「自动带出」，不计入操作步数（AC-7 口径）。
 */
export function MaterialCombobox({
  onSelect,
  label = '选择物料',
  placeholder = '输入 SKU 或名称搜索',
  initialKeyword = '',
}: MaterialComboboxProps) {
  const id = useId();
  const [keyword, setKeyword] = useState(initialKeyword);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Material | null>(null);
  const debounced = useDebouncedValue(keyword, 250);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!debounced.trim()) {
      setItems([]);
      return;
    }
    setLoading(true);
    api.materials
      .list({ keyword: debounced.trim(), status: 'ENABLED', pageSize: 8 })
      .then((page) => {
        if (!cancelled) setItems(page.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const choose = (material: Material) => {
    setSelected(material);
    setKeyword(`${material.sku}｜${material.name}`);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(material);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      if (open && activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        choose(items[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-700">
        {label}
        <span className="ml-0.5 text-stockout-fg" aria-hidden="true">
          *
        </span>
        <span className="sr-only">（必填）</span>
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-describedby={`${id}-hint`}
        autoComplete="off"
        value={keyword}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setKeyword(event.target.value);
          setSelected(null);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400"
      />
      <p id={`${id}-hint`} className="mt-1 text-xs text-ink-500">
        {loading ? '搜索中…' : selected ? `已选择：${selected.name}` : '也可直接输入完整 SKU 后选择结果'}
      </p>

      {open && keyword.trim() && !selected ? (
        <ul
          id={`${id}-list`}
          ref={listRef}
          role="listbox"
          aria-label="物料搜索结果"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-white shadow-lg"
        >
          {items.length === 0 && !loading ? (
            <li className="px-3 py-2 text-xs text-ink-500">无匹配物料（已停用的物料不可选）</li>
          ) : null}
          {items.map((item, index) => (
            <li key={item.sku} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(item)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
                  index === activeIndex ? 'bg-brand-50' : 'bg-white'
                }`}
              >
                <span className="font-mono text-ink-700">{item.sku}</span>
                <span className="text-ink-800">{item.name}</span>
                <Badge>{item.location}</Badge>
                <span className="ml-auto text-ink-400">{item.unit}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2 text-xs text-ink-700">
          <span className="font-medium">{selected.name}</span>
          <Badge>{selected.location}</Badge>
          <Badge tone="brand">{selected.unit}</Badge>
          <HealthBadge health="NORMAL" />
        </div>
      ) : null}
    </div>
  );
}
