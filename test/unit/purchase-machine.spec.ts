import {
  applyTransition,
  canTransition,
  PurchaseAction,
  PurchaseStatus,
} from '../../src/domain/purchase-machine';

describe('purchase-machine', () => {
  it('允许全部合法迁移', () => {
    const legal: Array<[PurchaseStatus, PurchaseAction, PurchaseStatus]> = [
      ['PENDING', 'APPROVE', 'APPROVED'],
      ['PENDING', 'REJECT', 'PENDING'],
      ['PENDING', 'RESUBMIT', 'PENDING'],
      ['APPROVED', 'CREATE_ORDER', 'PURCHASING'],
      ['PURCHASING', 'ARRIVE', 'COMPLETED'],
      ['ARRIVED', 'CLOSE', 'COMPLETED'],
    ];
    legal.forEach(([from, action, expected]) => {
      expect(canTransition(from, action)).toBe(true);
      const options = action === 'REJECT' ? { rejectReason: '预算不足' } : {};
      expect(applyTransition(from, action, options).next).toBe(expected);
    });
  });

  it('到货在事务内经过 ARRIVED 瞬时态后对外为 COMPLETED', () => {
    expect(applyTransition('PURCHASING', 'ARRIVE')).toEqual({
      next: 'COMPLETED',
      via: 'ARRIVED',
    });
  });

  it('驳回原因必填，否则不产生迁移', () => {
    expect(() => applyTransition('PENDING', 'REJECT')).toThrow('REJECT_REASON_REQUIRED');
    expect(() => applyTransition('PENDING', 'REJECT', { rejectReason: '   ' })).toThrow(
      'REJECT_REASON_REQUIRED',
    );
  });

  it('拒绝非法迁移且不产生副作用', () => {
    const illegal: Array<[PurchaseStatus, PurchaseAction]> = [
      ['PENDING', 'CREATE_ORDER'],
      ['PENDING', 'ARRIVE'],
      ['APPROVED', 'APPROVE'],
      ['APPROVED', 'ARRIVE'],
      ['PURCHASING', 'APPROVE'],
      ['PURCHASING', 'CLOSE'],
      ['ARRIVED', 'APPROVE'],
      ['COMPLETED', 'APPROVE'],
      ['COMPLETED', 'REJECT'],
      ['COMPLETED', 'CREATE_ORDER'],
    ];
    illegal.forEach(([from, action]) => {
      expect(canTransition(from, action)).toBe(false);
      expect(() => applyTransition(from, action)).toThrow('ILLEGAL_STATE_TRANSITION');
    });
  });
});
