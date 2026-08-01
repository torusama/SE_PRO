import {
  isConsultativeRecommendationNarrative,
  isGroundedRecommendationNarrative,
} from './agent-grounding';
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
      Trạng thái còn trống chỉ phản ánh thời điểm tìm kiếm và chưa phải là giữ chỗ hay xác nhận mua.
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
