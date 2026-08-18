import {
  extractInlineRecommendationCall,
  inlineRecommendationLimitMessage,
  isIncompleteProgressMessage,
} from './assistant-content.util';

describe('assistant content utilities', () => {
  it('recovers recommendation arguments emitted as fenced JSON', () => {
    const recovered = extractInlineRecommendationCall(`
Mình đang tìm kiếm các lô phù hợp.

\`\`\`json
{"budgetMax": 60000000, "numberOfPlots": 2}
\`\`\`
`);

    expect(recovered?.args).toEqual({
      budgetMax: 60000000,
      numberOfPlots: 2,
    });
  });

  it('ignores ordinary JSON that is not a recommendation payload', () => {
    expect(extractInlineRecommendationCall('Ví dụ: {"khu": "A"}')).toBeNull();
  });

  it('creates a natural response when the count exceeds the limit', () => {
    expect(inlineRecommendationLimitMessage(20)).toContain('tối đa 10 lô');
  });

  it('recognizes an unfinished progress-only response', () => {
    expect(
      isIncompleteProgressMessage(
        'Mình sẽ tìm kiếm các lô phù hợp. Xin vui lòng chờ.',
      ),
    ).toBe(true);
  });
});
