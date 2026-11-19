import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SuggestInput } from './ui/SuggestInput';

function Harness({ options, onChange }: { options: string[]; onChange?: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <SuggestInput
      id="loc"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      options={options}
      placeholder="库位"
    />
  );
}

const OPTIONS = ['A-01', 'A-02', 'A-03', 'B-01'];

describe('SuggestInput（库位候选输入）', () => {
  it('聚焦后展示候选，且符合 combobox 语义', async () => {
    const user = userEvent.setup();
    render(<Harness options={OPTIONS} />);

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');

    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('输入内容过滤候选', async () => {
    const user = userEvent.setup();
    render(<Harness options={OPTIONS} />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'A-0');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.textContent)).toEqual(['A-01', 'A-02', 'A-03']);
  });

  it('点击候选填入该值', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness options={OPTIONS} onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.click(screen.getByRole('option', { name: 'A-03' }));

    expect(onChange).toHaveBeenLastCalledWith('A-03');
    expect(input).toHaveValue('A-03');
  });

  it('键盘 ↓ + Enter 可选择，Esc 关闭', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness options={OPTIONS} onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenLastCalledWith('A-02');

    await user.click(input);
    expect(screen.queryByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('允许自由输入新库位，不被列表限制', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness options={OPTIONS} onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'Z-99');

    expect(input).toHaveValue('Z-99');
    expect(onChange).toHaveBeenLastCalledWith('Z-99');
    // 无匹配时不显示列表，但仍可继续输入
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
