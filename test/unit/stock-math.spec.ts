import {
  assertSufficient,
  availableStock,
  countAction,
  countDifference,
  reversalOf,
  sumSigned,
  transferLegs,
} from '../../src/domain/stock-math';
import { DomainError } from '../../src/domain/domain-error';

describe('stock-math', () => {
  it('汇总期初、入库、出库与盘盈盘亏的带符号数量', () => {
    expect(
      sumSigned([
        { quantity_signed: 10 },
        { quantity_signed: -3 },
        { quantity_signed: 2 },
        { quantity_signed: -1 },
      ]),
    ).toBe(8);
    expect(sumSigned([])).toBe(0);
  });

  it('可用库存 = 当前库存 − 锁定库存', () => {
    expect(availableStock(10, 0)).toBe(10);
    expect(availableStock(10, 3)).toBe(7);
  });

  it('出库校验拒绝库存不足和非正整数', () => {
    expect(() => assertSufficient(7, 3)).not.toThrow();
    expect(() => assertSufficient(0, 1)).toThrow(DomainError);
    try {
      assertSufficient(0, 1);
    } catch (error) {
      expect((error as DomainError).code).toBe('STOCK_INSUFFICIENT');
    }
    expect(() => assertSufficient(10, 0)).toThrow('正整数');
    expect(() => assertSufficient(10, -1)).toThrow('正整数');
  });

  it('盘点差额决定盘盈/盘亏/无流水', () => {
    expect(countDifference(12, 10)).toBe(2);
    expect(countAction(countDifference(12, 10))).toBe('COUNT_GAIN');
    expect(countAction(countDifference(8, 10))).toBe('COUNT_LOSS');
    expect(countAction(countDifference(10, 10))).toBeNull();
  });

  it('调拨两笔净额为 0，仅改变库位分布', () => {
    const legs = transferLegs(4, 'B-01', 'C-01');
    expect(legs).toEqual({
      out: { quantity_signed: -4, location: 'B-01' },
      in: { quantity_signed: 4, location: 'C-01' },
    });
    expect(sumSigned([legs.out, legs.in])).toBe(0);
    expect(() => transferLegs(1, 'A', 'A')).toThrow('不能相同');
  });

  it('冲正生成反向数量并关联原流水', () => {
    expect(reversalOf({ movementNo: 'MOV-1', quantitySigned: 10 })).toEqual({
      related_movement_no: 'MOV-1',
      quantity_signed: -10,
      type: 'REVERSAL',
    });
    expect(reversalOf({ movementNo: 'MOV-2', quantitySigned: -3 }).quantity_signed).toBe(3);
  });
});
