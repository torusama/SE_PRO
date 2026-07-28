import { isGroundedRecommendationNarrative } from './agent-grounding';
import { RecommendationResult } from './types/agent-response.types';

const result = {
  requirements: { budgetMax: 100_000_000, numberOfPlots: 1 },
  recommendations: [
    {
      optionId: 'OPT-001',
      plotIds: [1],
      plotCodes: ['A-01-001'],
    },
    {
      optionId: 'OPT-002',
      plotIds: [2],
      plotCodes: ['B-01-001'],
    },
  ],
  suggestedServices: [],
  rankerVersion: 'rule-based-v1',
  fallbackUsed: true,
} as unknown as RecommendationResult;

describe('agent recommendation grounding', () => {
  it('accepts plot codes present in tool output', () => {
    expect(
      isGroundedRecommendationNarrative(
        'Mình tìm được 2 phương án: A-01-001 và B-01-001.',
        result,
      ),
    ).toBe(true);
  });

  it('rejects invented plot codes', () => {
    expect(
      isGroundedRecommendationNarrative('Mình đề xuất lô C-99-999.', result),
    ).toBe(false);
  });

  it('rejects a claimed plot count larger than tool output', () => {
    expect(
      isGroundedRecommendationNarrative(
        'Dưới đây là 10 lô phù hợp nhất.',
        result,
      ),
    ).toBe(false);
  });

  it('rejects unsupported Bazi and deposit-readiness claims', () => {
    expect(
      isGroundedRecommendationNarrative(
        'Lô A-01-001 hướng Nam nên theo Bazi sẽ mang lại may mắn.',
        result,
      ),
    ).toBe(false);
    expect(
      isGroundedRecommendationNarrative(
        'Lô A-01-001 đang sẵn sàng để đặt cọc.',
        result,
      ),
    ).toBe(false);
  });
});
