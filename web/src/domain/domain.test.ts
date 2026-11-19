import { describe, expect, it } from 'vitest';
import { healthOf, suggestedQtyOf, HEALTH_RANK } from './health';
import { centsToYuan, defaultExpectedDate, yuanToCents } from './format';
import { canDo, isRejected, stepperIndex } from './purchase';

describe('healthOf（三态判定，与后端一致）', () => {
  it('库存为 0 或负数为断料', () => {
    expect(healthOf(0, 5)).toBe('STOCKOUT');
    expect(healthOf(-3, 5)).toBe('STOCKOUT');
  });

  it('安全库存为 0 时任何 0 库存都判断料（先判断料）', () => {
    expect(healthOf(0, 0)).toBe('STOCKOUT');
    expect(healthOf(1, 0)).toBe('NORMAL');
  });

  it('等于安全库存为预警，高于为正常', () => {
    expect(healthOf(2, 2)).toBe('LOW');
    expect(healthOf(3, 2)).toBe('NORMAL');
  });

  it('断料优先级高于预警', () => {
    expect(HEALTH_RANK.STOCKOUT).toBeLessThan(HEALTH_RANK.LOW);
    expect(HEALTH_RANK.LOW).toBeLessThan(HEALTH_RANK.NORMAL);
  });
});

describe('suggestedQtyOf（与后端公式一致）', () => {
  it('补至 2 倍安全库存', () => {
    expect(suggestedQtyOf(0, 5)).toBe(10);
    expect(suggestedQtyOf(1, 2)).toBe(3);
  });

  it('结果至少为 1', () => {
    expect(suggestedQtyOf(100, 1)).toBe(1);
  });
});

describe('金额换算', () => {
  it('分转元保留两位', () => {
    expect(centsToYuan(89900)).toBe('899.00');
    expect(centsToYuan(5)).toBe('0.05');
    expect(centsToYuan(0)).toBe('0.00');
  });

  it('元转分只接受最多两位小数', () => {
    expect(yuanToCents('899.00')).toBe(89900);
    expect(yuanToCents('12.3')).toBe(1230);
    expect(yuanToCents('12.345')).toBeNull();
    expect(yuanToCents('abc')).toBeNull();
    expect(yuanToCents('-1')).toBeNull();
  });
});

describe('采购状态机（UI 预判）', () => {
  it('待审批可审批，已完成无动作', () => {
    expect(canDo('PENDING', 'APPROVE')).toBe(true);
    expect(canDo('PENDING', 'REJECT')).toBe(true);
    expect(canDo('COMPLETED', 'APPROVE')).toBe(false);
  });

  it('到货即完成：COMPLETED 时步骤条全部达成', () => {
    expect(stepperIndex('COMPLETED')).toBe(5);
    expect(stepperIndex('PURCHASING')).toBe(2);
  });

  it('驳回后状态仍是 PENDING，靠 rejectReason 区分', () => {
    expect(isRejected({ status: 'PENDING', rejectReason: '预算超限' })).toBe(true);
    expect(isRejected({ status: 'PENDING', rejectReason: '' })).toBe(false);
  });
});

describe('期望到货日期默认值', () => {
  it('默认 today + 7 天', () => {
    expect(defaultExpectedDate(new Date('2026-11-19T08:00:00+08:00'))).toBe('2026-11-26');
  });
});
