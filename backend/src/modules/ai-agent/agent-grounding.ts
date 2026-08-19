import {
  RecommendationOption,
  RecommendationResult,
} from './types/agent-response.types';

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

export interface RecommendationNarrativeValidationOptions {
  /** Default true for backward compatibility with existing deterministic-sized results. */
  requireEveryOption?: boolean;
  /** Minimum number of grounded recommendation groups that must be discussed. */
  minimumOptions?: number;
  /** Maximum number of grounded recommendation groups that may be discussed. */
  maximumOptions?: number;
}

function mentionedRecommendationOptions(
  content: string,
  result: RecommendationResult,
): RecommendationOption[] {
  return result.recommendations.filter((option) =>
    option.plotCodes.some((code) => content.includes(code)),
  );
}

export function isConsultativeRecommendationNarrative(
  content: string,
  result: RecommendationResult,
  options: RecommendationNarrativeValidationOptions = {},
) {
  if (!isGroundedRecommendationNarrative(content, result)) return false;
  if (!result.recommendations.length) return true;

  const discussedOptions = mentionedRecommendationOptions(content, result);
  const requireEveryOption = options.requireEveryOption ?? true;
  if (
    requireEveryOption &&
    discussedOptions.length !== result.recommendations.length
  ) {
    return false;
  }
  if (
    options.minimumOptions !== undefined &&
    discussedOptions.length < options.minimumOptions
  ) {
    return false;
  }
  if (
    options.maximumOptions !== undefined &&
    discussedOptions.length > options.maximumOptions
  ) {
    return false;
  }

  const wordCount = content.trim().split(/\s+/u).filter(Boolean).length;
  // A concise, grounded answer is preferable to rejecting a useful response
  // and waiting through another large-model timeout. Coverage, trade-off,
  // recommendation and grounding checks below still protect quality.
  const minimumWords = discussedOptions.length > 1 ? 80 : 55;
  if (wordCount < minimumWords) return false;

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
 * Convert an LLM-written ranking back into an authoritative UI payload. The
 * model may choose/reorder only options already present in the grounded
 * candidate result; it can never manufacture a new plot through prose.
 */
export function selectRecommendationsFromNarrative(
  content: string,
  result: RecommendationResult,
  desiredCount: number,
): RecommendationResult | null {
  if (!Number.isInteger(desiredCount) || desiredCount < 1) return null;
  if (!isGroundedRecommendationNarrative(content, result)) return null;

  const optionByCode = new Map<string, RecommendationOption>();
  const canonicalCodes = new Map<string, string>();
  for (const option of result.recommendations) {
    for (const code of option.plotCodes) {
      optionByCode.set(code.toUpperCase(), option);
      canonicalCodes.set(code.toUpperCase(), code);
    }
  }

  const ordered: RecommendationOption[] = [];
  const seen = new Set<string>();
  const addCode = (code: string) => {
    const option = optionByCode.get(code.trim().toUpperCase());
    if (!option || seen.has(option.optionId)) return;
    seen.add(option.optionId);
    ordered.push(option);
  };

  // The recommendation headings are the clearest statement of the model's
  // final order. Match against the actual grounded codes rather than assuming
  // a fixed A-01-001 format so future admin-defined plot codes still work.
  const upperContent = content.toUpperCase();
  for (const match of content.matchAll(
    /^###\s+Phương\s+án\s+\d+\s+[—-]\s+(.+)$/gimu,
  )) {
    const headingTail = match[1].trim().toUpperCase();
    const code = [...canonicalCodes.keys()]
      .sort((a, b) => b.length - a.length)
      .find((candidate) => headingTail.startsWith(candidate));
    if (code) addCode(code);
  }
  if (ordered.length < desiredCount) {
    const mentions = [...canonicalCodes.keys()]
      .map((code) => ({ code, index: upperContent.indexOf(code) }))
      .filter((item) => item.index >= 0)
      .sort((a, b) => a.index - b.index);
    for (const mention of mentions) {
      addCode(mention.code);
      if (ordered.length === desiredCount) break;
    }
  }

  if (ordered.length !== desiredCount) return null;
  return {
    ...result,
    requirements: {
      ...result.requirements,
      recommendationCount: desiredCount,
    },
    recommendations: ordered,
  };
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
