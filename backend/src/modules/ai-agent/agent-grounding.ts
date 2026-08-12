import { RecommendationResult } from './types/agent-response.types';

export function isRecommendationResult(
  value: unknown,
): value is RecommendationResult {
  return (
    !!value &&
    typeof value === 'object' &&
    'recommendations' in value &&
    Array.isArray(value.recommendations)
  );
}

export function isGroundedRecommendationNarrative(
  content: string,
  result: RecommendationResult,
) {
  const allowedCodes = new Set(
    result.recommendations.flatMap((option) => option.plotCodes),
  );
  const mentionedCodes = [...content.matchAll(/\b[A-Z]-\d{2}-\d{3}\b/g)].map(
    (match) => match[0],
  );
  if (mentionedCodes.some((code) => !allowedCodes.has(code))) {
    return false;
  }

  const allowedPlotCount = allowedCodes.size;
  for (const match of content.matchAll(/(\d+)\s+lô(?=\s|[.,;:!?]|$)/gi)) {
    if (Number(match[1]) > allowedPlotCount) return false;
  }
  for (const match of content.matchAll(
    /(?:tìm (?:được|thấy)|dưới đây là)\s+(\d+)\s+(?:phương án|lựa chọn)/gi,
  )) {
    if (Number(match[1]) > result.recommendations.length) return false;
  }
  if (!result.baziSuggestion) {
    const unsupportedSpiritualClaim =
      /(?:\b(?:bazi|phong\s*thủy)\b.{0,80}\b(?:hợp(?:\s+mệnh)?|phù\s+hợp|khắc|tốt|xấu|cát|hung|may\s*mắn|tài\s*lộc|vượng|mang\s+lại|đem\s+lại)\b|\b(?:may\s*mắn|tài\s*lộc|vượng)\b)/isu;
    if (unsupportedSpiritualClaim.test(content)) return false;
  }
  if (
    /sẵn\s+sàng\s+(?:để\s+)?(?:đặt\s+cọc|mua)|có\s+thể\s+đặt\s+cọc\s+ngay/i.test(
      content,
    )
  ) {
    return false;
  }
  return true;
}

export function isConsultativeRecommendationNarrative(
  content: string,
  result: RecommendationResult,
) {
  if (!isGroundedRecommendationNarrative(content, result)) return false;
  if (!result.recommendations.length) return true;

  const wordCount = content.trim().split(/\s+/u).filter(Boolean).length;
  // A concise, grounded answer is preferable to rejecting a useful response
  // and waiting through another large-model timeout. Coverage, trade-off,
  // recommendation and grounding checks below still protect quality.
  const minimumWords = result.recommendations.length > 1 ? 80 : 55;
  if (wordCount < minimumWords) return false;

  const coversEveryOption = result.recommendations.every((option) =>
    option.plotCodes.some((code) => content.includes(code)),
  );
  if (!coversEveryOption) return false;

  const hasTradeOff =
    /(?:cân\s+nhắc|lưu\s+ý|đổi\s+lại|hạn\s+chế|đánh\s+đổi|cần\s+kiểm\s+tra|trade-?off|consider|however|limitation|verify)/iu.test(
      content,
    );
  const hasProfessionalRecommendation =
    /(?:ưu\s+tiên|nghiêng\s+về|khuyến\s+nghị|đề\s+xuất|phù\s+hợp\s+hơn|recommend|prefer|lean\s+toward|strongest\s+option)/iu.test(
      content,
    );
  const endsWithQuestion = /\?\s*$/u.test(content);

  return hasTradeOff && hasProfessionalRecommendation && endsWithQuestion;
}

/**
 * Models occasionally follow the content contract but emit every option in one
 * visual paragraph. Split the first discussion of each recommendation into its
 * own Markdown paragraph without changing any grounded wording or facts.
 */
export function ensureRecommendationParagraphs(
  content: string,
  result: RecommendationResult,
) {
  let formatted = content.replace(/\r\n?/g, '\n').trim();

  for (const option of result.recommendations) {
    const indexes = option.plotCodes
      .map((code) => formatted.indexOf(code))
      .filter((index) => index >= 0);
    if (!indexes.length) continue;

    const codeIndex = Math.min(...indexes);
    const lineStart = formatted.lastIndexOf('\n', codeIndex - 1) + 1;
    let sectionStart = lineStart;

    if (formatted.slice(lineStart, codeIndex).trim()) {
      const sentenceStarts = [
        formatted.lastIndexOf('. ', codeIndex - 1),
        formatted.lastIndexOf('! ', codeIndex - 1),
        formatted.lastIndexOf('? ', codeIndex - 1),
      ];
      const latestSentenceBoundary = Math.max(...sentenceStarts);
      sectionStart =
        latestSentenceBoundary >= 0 ? latestSentenceBoundary + 2 : 0;
    }

    if (
      sectionStart > 0 &&
      formatted.slice(sectionStart - 2, sectionStart) !== '\n\n'
    ) {
      formatted = `${formatted.slice(0, sectionStart).trimEnd()}\n\n${formatted.slice(sectionStart).trimStart()}`;
    }
  }

  return formatted.replace(/\n{3,}/g, '\n\n');
}
