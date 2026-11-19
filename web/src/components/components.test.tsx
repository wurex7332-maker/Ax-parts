import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HealthBadge, HealthLegend } from '../components/health/HealthBadge';
import { StatusStepper } from '../components/domain/StatusStepper';
import { MobileLayout } from '../components/layout/MobileLayout';
import { useSession } from '../state/session';

describe('HealthBadge', () => {
  it('三态均以文字 + 图标双编码，不只依赖颜色', () => {
    const { container } = render(
      <div>
        <HealthBadge health="NORMAL" currentStock={5} safetyStock={3} />
        <HealthBadge health="LOW" currentStock={1} safetyStock={2} />
        <HealthBadge health="STOCKOUT" currentStock={0} safetyStock={5} />
      </div>,
    );

    expect(screen.getByText('正常')).toBeInTheDocument();
    expect(screen.getByText('预警')).toBeInTheDocument();
    expect(screen.getByText('断料')).toBeInTheDocument();

    const badges = container.querySelectorAll('[role="status"]');
    expect(badges).toHaveLength(3);
    expect(badges[2].getAttribute('aria-label')).toContain('断料');
    expect(badges[2].getAttribute('aria-label')).toContain('需立即补货');
  });

  it('图例包含三态说明', () => {
    render(<HealthLegend />);
    expect(screen.getByText(/断料优先级高于预警/)).toBeInTheDocument();
  });
});

describe('StatusStepper', () => {
  it('已完成时五个节点全部达成', () => {
    const { container } = render(<StatusStepper status="COMPLETED" />);
    const circles = container.querySelectorAll('ol li span[aria-hidden="true"]');
    expect(Array.from(circles).filter((el) => el.textContent === '✓').length).toBe(5);
  });

  it('驳回时标注退回待审批', () => {
    render(<StatusStepper status="PENDING" rejected />);
    expect(screen.getByText(/已驳回，状态退回待审批/)).toBeInTheDocument();
  });
});

describe('AC-10 手机端权限边界', () => {
  it('移动端子树不包含任何 /admin 链接', () => {
    useSession.getState().setRole('supervisor');
    const { container } = render(
      <MemoryRouter initialEntries={['/m/scan']}>
        <Routes>
          <Route path="/m" element={<MobileLayout />}>
            <Route path="scan" element={<p>扫码页占位</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(container.querySelector('a[href*="/admin"]')).toBeNull();
    expect(screen.queryByText('辅料档案')).toBeNull();
    expect(screen.queryByText('盘点')).toBeNull();
    expect(screen.queryByText('报表')).toBeNull();
  });

  it('operator 视角不出现审批入口', () => {
    useSession.getState().setRole('operator');
    render(
      <MemoryRouter initialEntries={['/m/scan']}>
        <Routes>
          <Route path="/m" element={<MobileLayout />}>
            <Route path="scan" element={<p>扫码页占位</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const nav = screen.getByRole('navigation', { name: '移动端主导航' });
    expect(nav.textContent).not.toContain('审批');
    expect(nav.textContent).toContain('领用');
  });
});
