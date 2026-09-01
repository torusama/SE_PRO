import {
  ensureRecommendationParagraphs,
  isConsultativeRecommendationNarrative,
  isGroundedRecommendationNarrative,
  normalizeGroundedMoneyScale,
  sanitizeUnsupportedPlotInferences,
  selectRecommendationsFromNarrative,
} from './agent-grounding';
import {
  RecommendationOption,
  RecommendationResult,
} from './types/agent-response.types';

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
        'A-01-001 có dữ liệu hướng nhưng chưa đủ thông tin để kết luận phong thủy.',
        result,
      ),
    ).toBe(true);
    expect(
      isGroundedRecommendationNarrative(
        'Lô A-01-001 đang sẵn sàng để đặt cọc.',
        result,
      ),
    ).toBe(false);
    expect(
      isGroundedRecommendationNarrative(
        'A-01-001 rộng hơn nên phù hợp cho việc bố trí mộ và vật phẩm kèm.',
        result,
      ),
    ).toBe(false);
  });

  it('rejects a monetary scale invented by the response composer', () => {
    const pricedResult = {
      ...result,
      recommendations: [
        {
          ...result.recommendations[0],
          plotCost: 29_000_000,
          estimatedTotal: 29_000_000,
        },
      ],
    } as RecommendationResult;

    expect(
      isGroundedRecommendationNarrative(
        'Lô A-01-001 có tổng giá 29.000.000 VND.',
        pricedResult,
      ),
    ).toBe(true);
    expect(
      isGroundedRecommendationNarrative(
        'Lô A-01-001 có tổng giá 29.000 VND.',
        pricedResult,
      ),
    ).toBe(false);
    expect(
      normalizeGroundedMoneyScale(
        'Lô A-01-001 có tổng giá 29.000 VND.',
        pricedResult,
      ),
    ).toContain('29.000.000 VND');
  });
});

describe('plot follow-up grounding guard', () => {
  it('removes unsupported capacity, storage, landscaping and ambience claims', () => {
    const answer = `Bạn nên chọn **lô H-02-001**.
- **Diện tích lớn hơn**: 3 m², giúp bạn có không gian linh hoạt hơn cho việc bố trí và bảo quản.
- **Khu vực**: Khu H – Mộ đơn thường có môi trường yên tĩnh, cây xanh và không bị đông đúc như khu F.
- H-02-001 vẫn nằm trong ngân sách.`;

    const sanitized = sanitizeUnsupportedPlotInferences(answer);

    expect(sanitized).toContain('H-02-001');
    expect(sanitized).toContain('3 m²');
    expect(sanitized).toContain('vẫn nằm trong ngân sách');
    expect(sanitized).not.toMatch(
      /bố trí|bảo quản|yên tĩnh|cây xanh|đông đúc/iu,
    );
  });

  it('keeps an explicit statement that an ambience quality is unverified', () => {
    const answer =
      'Với lô A-01-001, hiện chưa có dữ liệu xác minh khu này yên tĩnh hay gần cây xanh.';

    expect(sanitizeUnsupportedPlotInferences(answer)).toBe(answer);
  });
});

describe('agent recommendation consultation depth', () => {
  it('rejects a grounded but shallow recommendation', () => {
    expect(
      isConsultativeRecommendationNarrative(
        'Mình đề xuất A-01-001 vì lô này khá phù hợp với yêu cầu của bạn.',
        result,
      ),
    ).toBe(false);
  });

  it('rejects an answer that skips one of the returned options', () => {
    const longButIncomplete = `${'Mình đã phân tích nhu cầu và ngân sách của gia đình. '.repeat(14)}
      Mình ưu tiên A-01-001 vì mức giá và khu vực phù hợp. Điểm cần cân nhắc là gia đình nên kiểm tra vị trí thực tế trước khi quyết định. Bạn muốn xem lô này trên bản đồ?`;
    expect(
      isConsultativeRecommendationNarrative(longButIncomplete, result),
    ).toBe(false);
  });

  it('rejects a detailed answer that does not continue the consultation', () => {
    const noFollowUp = `
      Mình đã đối chiếu hai phương án trong ngân sách của gia đình.
      A-01-001 là phương án mình ưu tiên vì có mức phù hợp tổng thể cao hơn và thông tin giá được lấy từ quỹ lô đang trống.
      Điểm cần cân nhắc là hướng, diện tích và vị trí thực tế vẫn nên được kiểm tra trên bản đồ trước khi gửi yêu cầu.
      B-01-001 là phương án thay thế để gia đình cân nhắc nếu muốn đổi khu vực.
      So với A-01-001, phương án này có tiêu chí khác biệt nhưng không nên được chọn chỉ dựa trên điểm số.
      Mình nghiêng về A-01-001 nếu ưu tiên giữ ngân sách, còn B-01-001 phù hợp hơn khi khu vực là yếu tố quan trọng.
      Trạng thái còn trống chỉ phản ánh thời điểm tìm kiếm và chưa phải là yêu cầu mua đã được duyệt.
      Gia đình nên xem cả hai vị trí, đối chiếu phần chênh lệch và chỉ tạo yêu cầu sau khi đã xác nhận lựa chọn.
    `;
    expect(isConsultativeRecommendationNarrative(noFollowUp, result)).toBe(
      false,
    );
  });

  it('accepts a grounded comparison with trade-offs, recommendation and next question', () => {
    const consultative = `
      Dựa trên ngân sách và nhu cầu một lô của gia đình, mình đã đối chiếu hai phương án còn trống.
      A-01-001 là phương án mình ưu tiên vì tổng giá nằm trong giới hạn, thông tin khu vực rõ ràng và mức phù hợp tổng thể cao hơn.
      Điểm cần cân nhắc là gia đình vẫn nên kiểm tra hướng, diện tích và vị trí thực tế trên bản đồ trước khi gửi yêu cầu.

      B-01-001 là phương án thay thế đáng xem nếu gia đình muốn có thêm lựa chọn về khu vực.
      So với A-01-001, phương án này có thể phù hợp với một ưu tiên khác, nhưng cần kiểm tra phần chênh lệch giá và khả năng tiếp cận cổng từ dữ liệu nội khu.
      Mình không xem điểm số là bảo đảm; nó chỉ hỗ trợ sắp xếp từ các tiêu chí đã cung cấp.

      Nếu ưu tiên giữ ngân sách và chọn phương án cân bằng, mình nghiêng về A-01-001.
      Nếu khu vực quan trọng hơn, B-01-001 nên được mở trên bản đồ để so sánh trực tiếp.
      Bạn muốn mình so sánh kỹ chi phí và diện tích của hai phương án hay mở phương án ưu tiên trên bản đồ?
    `;
    expect(isConsultativeRecommendationNarrative(consultative, result)).toBe(
      true,
    );
  });
});

describe('LLM recommendation candidate selection', () => {
  it('lets an LLM choose a strict grounded subset without requiring every candidate', () => {
    const consultative = `${'Mình đã cân nhắc kỹ ngân sách, khu vực, diện tích và khả năng tiếp cận của gia đình. '.repeat(10)}

  ### Phương án 1 — B-01-001
  B-01-001 là phương án mình ưu tiên. Điểm cần cân nhắc là cần kiểm tra vị trí thực tế. Bạn muốn mình mở lô này trên bản đồ?`;
    expect(
      isConsultativeRecommendationNarrative(consultative, result, {
        requireEveryOption: false,
        minimumOptions: 1,
        maximumOptions: 1,
      }),
    ).toBe(true);
  });

  it('converts the LLM heading order back into the final grounded recommendation payload', () => {
    const selected = selectRecommendationsFromNarrative(
      '### Phương án 1 — B-01-001\nPhân tích.\n\n### Phương án 2 — A-01-001\nPhân tích.',
      result,
      2,
    );

    expect(selected?.recommendations.map((item) => item.optionId)).toEqual([
      'OPT-002',
      'OPT-001',
    ]);
    expect(selected?.requirements.recommendationCount).toBe(2);
  });

  it('maps admin-defined plot codes without assuming the legacy A-01-001 shape', () => {
    const customCodeResult: RecommendationResult = {
      ...result,
      recommendations: [
        {
          ...result.recommendations[0],
          optionId: 'OPT-VIP',
          plotCodes: ['VIP-A1'],
        },
      ],
    };
    const selected = selectRecommendationsFromNarrative(
      '### Phương án 1 — VIP-A1\nPhân tích phương án VIP-A1.',
      customCodeResult,
      1,
    );

    expect(selected?.recommendations[0].optionId).toBe('OPT-VIP');
  });

  it('selects an adjacent group by the complete heading instead of one shared plot code', () => {
    const groupedResult: RecommendationResult = {
      ...result,
      recommendations: [
        {
          optionId: 'PAIR-A',
          plotIds: [10, 11],
          plotCodes: ['H-02-004', 'H-01-004'],
        },
        {
          optionId: 'PAIR-B',
          plotIds: [11, 12],
          plotCodes: ['H-01-004', 'H-01-003'],
        },
      ] as RecommendationOption[],
    };

    const selected = selectRecommendationsFromNarrative(
      '### Phương án 1 — H-02-004 / H-01-004\nPhân tích.',
      groupedResult,
      1,
    );

    expect(selected?.recommendations[0].optionId).toBe('PAIR-A');
  });

  it('rejects an ambiguous adjacent-group heading that names only a shared code', () => {
    const groupedResult: RecommendationResult = {
      ...result,
      recommendations: [
        {
          optionId: 'PAIR-A',
          plotIds: [10, 11],
          plotCodes: ['H-02-004', 'H-01-004'],
        },
        {
          optionId: 'PAIR-B',
          plotIds: [11, 12],
          plotCodes: ['H-01-004', 'H-01-003'],
        },
      ] as RecommendationOption[],
    };

    expect(
      selectRecommendationsFromNarrative(
        '### Phương án 1 — H-01-004\nPhân tích.',
        groupedResult,
        1,
      ),
    ).toBeNull();
  });
});

describe('recommendation paragraph formatting', () => {
  it('separates the first analysis sentence for every recommended option', () => {
    const formatted = ensureRecommendationParagraphs(
      'Mình đã đối chiếu hai phương án. A-01-001 phù hợp ngân sách và cần kiểm tra hướng. B-01-001 rộng hơn nhưng giá cao hơn. Bạn muốn xem phương án nào?',
      result,
    );

    expect(formatted).toContain(
      'Mình đã đối chiếu hai phương án.\n\nA-01-001 phù hợp',
    );
    expect(formatted).toContain('kiểm tra hướng.\n\nB-01-001 rộng hơn');
  });
});
