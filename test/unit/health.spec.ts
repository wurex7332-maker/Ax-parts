import { classify } from '../../src/domain/health';

describe('health.classify', () => {
  it('库存 <= 0 为断料且优先级最高', () => {
    expect(classify(0, 5)).toBe('STOCKOUT');
    expect(classify(-1, 5)).toBe('STOCKOUT');
    expect(classify(0, 0)).toBe('STOCKOUT');
  });

  it('0 < 库存 <= 安全库存为预警，含等于阈值的边界', () => {
    expect(classify(1, 2)).toBe('LOW');
    expect(classify(2, 2)).toBe('LOW');
    expect(classify(10, 10)).toBe('LOW');
  });

  it('库存 > 安全库存为正常', () => {
    expect(classify(3, 2)).toBe('NORMAL');
    expect(classify(1, 0)).toBe('NORMAL');
  });

  it('与种子数据预期一致', () => {
    const cases: Array<[number, number, string]> = [
      [3, 2, 'NORMAL'],
      [1, 2, 'LOW'],
      [0, 5, 'STOCKOUT'],
      [8, 3, 'NORMAL'],
      [12, 10, 'NORMAL'],
      [2, 2, 'LOW'],
    ];
    cases.forEach(([current, safety, expected]) => {
      expect(classify(current, safety)).toBe(expected);
    });
  });
});
