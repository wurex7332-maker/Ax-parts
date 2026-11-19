import { isSuggestionCandidate, suggestedQuantity } from '../../src/domain/suggestion';

describe('suggestion', () => {
  it('按 max(2 × 安全库存 − 当前库存, 1) 计算', () => {
    expect(suggestedQuantity(1, 2)).toBe(3); // PC-002
    expect(suggestedQuantity(2, 2)).toBe(2); // NET-006
    expect(suggestedQuantity(0, 5)).toBe(10); // HDD-003
    expect(suggestedQuantity(12, 2)).toBe(1); // 下限 1
  });

  it('只为启用且预警/断料的 SKU 生成建议', () => {
    expect(isSuggestionCandidate('LOW', true)).toBe(true);
    expect(isSuggestionCandidate('STOCKOUT', true)).toBe(true);
    expect(isSuggestionCandidate('NORMAL', true)).toBe(false);
    expect(isSuggestionCandidate('LOW', false)).toBe(false);
  });
});
