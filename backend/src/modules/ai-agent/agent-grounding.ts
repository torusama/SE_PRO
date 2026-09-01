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
  return getRecommendationNarrativeGroundingIssue(content, result) === null;
}

export function getRecommendationNarrativeGroundingIssue(
  content: string,
  result: RecommendationResult,
): string | null {
  const allowedCodes = new Set(
    result.recommendations.flatMap((option) => option.plotCodes),
  );
  const mentionedCodes = [...content.matchAll(/\b[A-Z]-\d{2}-\d{3}\b/g)].map(
    (match) => match[0],
  );
  if (mentionedCodes.some((code) => !allowedCodes.has(code))) {
    return 'invented_plot_code';
  }

  const allowedPlotCount = allowedCodes.size;
  for (const match of content.matchAll(/(\d+)\s+lô(?=\s|[.,;:!?]|$)/gi)) {
    if (Number(match[1]) > allowedPlotCount) return 'inflated_plot_count';
  }
  for (const match of content.matchAll(
    /(?:tìm (?:được|thấy)|dưới đây là)\s+(\d+)\s+(?:phương án|lựa chọn)/gi,
  )) {
    if (Number(match[1]) > result.recommendations.length) {
      return 'inflated_recommendation_count';
    }
  }
  const ungroundedMoney = findUngroundedMoneyMention(content, result);
  if (ungroundedMoney !== null) {
    return `ungrounded_money:${ungroundedMoney}`;
  }
  if (!result.baziSuggestion) {
    const unsupportedSpiritualClaim =
      /(?:\b(?:bazi|phong\s*thủy)\b.{0,80}\b(?:hợp(?:\s+mệnh)?|phù\s+hợp|khắc|tốt|xấu|cát|hung|may\s*mắn|tài\s*lộc|vượng|mang\s+lại|đem\s+lại)\b|\b(?:may\s*mắn|tài\s*lộc|vượng)\b)/isu;
    if (unsupportedSpiritualClaim.test(content)) {
      return 'unsupported_spiritual_claim';
    }
  }
  if (
    /sẵn\s+sàng\s+(?:để\s+)?(?:đặt\s+cọc|mua)|có\s+thể\s+đặt\s+cọc\s+ngay/i.test(
      content,
    )
  ) {
    return 'unsupported_deposit_readiness';
  }
  if (
    /(?:phù\s+hợp|đủ|thuận\s+tiện)\b.{0,70}(?:an\s+táng|mai\s+táng|bố\s+trí\s+mộ|vật\s+phẩm|lưu\s+trữ|bảo\s+quản)|(?:không\s+gian|diện\s+tích)\b.{0,50}(?:vật\s+phẩm|lưu\s+trữ|bảo\s+quản)/isu.test(
      content,
    )
  ) {
    return 'unsupported_burial_capacity';
  }
  return null;
}

function findUngroundedMoneyMention(
  content: string,
  result: RecommendationResult,
): number | null {
  const allowed = collectAllowedMoneyAmounts(result);
  for (const match of content.matchAll(createMoneyPattern())) {
    const amount = parseMoneyAmount(match[1], match[2]);
    if (amount === null) return Number.NaN;
    if (!allowed.has(amount)) return amount;
  }
  return null;
}

function collectAllowedMoneyAmounts(result: RecommendationResult) {
  const allowed = new Set<number>();
  const add = (value: unknown) => {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount >= 0) allowed.add(Math.round(amount));
  };
  add(result.requirements.budgetMin);
  add(result.requirements.budgetMax);
  add(result.inventoryPriceContext?.minimumListedPrice);
  add(result.inventoryPriceContext?.medianListedPrice);
  add(result.inventoryPriceContext?.maximumListedPrice);
  for (const service of result.suggestedServices ?? []) add(service.basePrice);

  const totals: number[] = [];
  for (const option of result.recommendations) {
    add(option.plotCost);
    add(option.serviceCost);
    add(option.estimatedTotal);
    const total = Number(option.estimatedTotal);
    if (Number.isFinite(total)) totals.push(total);
    for (const plot of option.plots ?? []) add(plot.price);
    const budgetMax = Number(result.requirements.budgetMax);
    if (Number.isFinite(budgetMax) && Number.isFinite(total)) {
      add(budgetMax - total);
    }
  }
  for (let left = 0; left < totals.length; left += 1) {
    for (let right = left + 1; right < totals.length; right += 1) {
      add(Math.abs(totals[left] - totals[right]));
    }
  }
  return allowed;
}

function createMoneyPattern() {
  return /(\d{1,3}(?:[.\s\u00a0\u202f]\d{3})+|\d+(?:[.,]\d+)?)\s*(tỷ|ty|triệu|trieu|tr|VND|VNĐ|đồng)(?=\s|[.,;:!?)]|$)/giu;
}

function parseMoneyAmount(rawValue: string, rawUnit: string) {
  const raw = rawValue.replace(/[\s\u00a0\u202f]/gu, '');
  const grouped = /^\d{1,3}(?:\.\d{3})+$/u.test(raw);
  const numeric = Number(
    grouped ? raw.replace(/\./g, '') : raw.replace(',', '.'),
  );
  if (!Number.isFinite(numeric)) return null;
  const unit = rawUnit.toLocaleLowerCase('vi-VN');
  const multiplier = /^(?:tỷ|ty)$/u.test(unit)
    ? 1_000_000_000
    : /^(?:triệu|trieu|tr)$/u.test(unit)
      ? 1_000_000
      : 1;
  return Math.round(numeric * multiplier);
}

/** Correct an unambiguous lost-thousands separator (for example 29.000 VND
 * when the only grounded matching value is 29.000.000 VND). Any other
 * ungrounded amount remains unchanged and is rejected by the validator. */
export function normalizeGroundedMoneyScale(
  content: string,
  result: RecommendationResult,
) {
  const allowed = collectAllowedMoneyAmounts(result);
  return content.replace(
    createMoneyPattern(),
    (full, rawValue: string, rawUnit: string) => {
      const amount = parseMoneyAmount(rawValue, rawUnit);
      if (amount === null || allowed.has(amount)) return full;
      const corrections = [...allowed].filter(
        (candidate) =>
          candidate === amount * 1_000 || candidate === amount * 1_000_000,
      );
      if (corrections.length !== 1) return full;
      return `${new Intl.NumberFormat('vi-VN').format(corrections[0])} VND`;
    },
  );
}

/**
 * Remove a narrow set of positive plot claims that the catalogue does not
 * currently store. Follow-up answers are composed from conversation history,
 * so they do not have a fresh RecommendationResult to run through the full
 * grounding validator. This final guard keeps otherwise useful comparisons
 * while preventing a model from turning area/zone names into invented burial
 * capacity, storage, landscaping, crowding, or ambience claims.
 */
export function sanitizeUnsupportedPlotInferences(content: string) {
  if (!/\b[A-Z]-\d{2}-\d{3}\b/u.test(content)) return content;

  let sanitized = content
    .replace(/\bđịa\s+hình\s+nhỏ\s+gọn\b/giu, 'diện tích nhỏ gọn')
    .replace(
      /,\s*(?:giúp|cho\s+phép|tạo)\b[^.\n]*(?:không\s+gian|bố\s+trí|bảo\s+quản|lưu\s+trữ|vật\s+phẩm)[^.\n]*/giu,
      '',
    )
    .replace(
      /,?\s*(?:và\s+)?đủ\s+(?:để|cho)\s+(?:một\s+)?(?:mộ|phần\s+mộ|mai\s+táng|vật\s+phẩm)[^.\n]*/giu,
      '',
    );

  const unsupportedAmbience =
    /(?:môi\s+trường\s+)?yên\s+tĩnh|cây\s+xanh|không\s+(?:bị\s+)?đông\s+đúc|thanh\s+tịnh|(?:tìm|có)\s+(?:thêm\s+)?lô\s+lân\s+cận.{0,40}mở\s+rộng|lợi\s+thế\s+về\s+vị\s+trí.{0,30}đặt\s+trước/iu;
  const explicitUncertainty =
    /(?:chưa|không)\s+(?:có|đủ)\s*.{0,45}(?:dữ\s+liệu|thông\s+tin|xác\s+minh)/iu;

  sanitized = sanitized
    .split('\n')
    .map((line) => {
      if (
        !unsupportedAmbience.test(line) ||
        explicitUncertainty.test(line)
      ) {
        return line;
      }

      const unsupportedStart = line.search(
        /\s+(?:thường\s+)?(?:có\s+)?(?:môi\s+trường\s+)?(?:yên\s+tĩnh|cây\s+xanh|không\s+(?:bị\s+)?đông\s+đúc|thanh\s+tịnh)/iu,
      );
      if (unsupportedStart > 0) {
        return `${line.slice(0, unsupportedStart).replace(/[,:;\s]+$/u, '')}.`;
      }
      return '';
    })
    .join('\n');

  return sanitized.replace(/\n{3,}/gu, '\n\n').trim();
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

  const canonicalCodes = new Map<string, string>();
  for (const option of result.recommendations) {
    for (const code of option.plotCodes) {
      canonicalCodes.set(code.toUpperCase(), code);
    }
  }

  const ordered: RecommendationOption[] = [];
  const seen = new Set<string>();
  const addOption = (option: RecommendationOption | undefined) => {
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
    const headingCodes = [...canonicalCodes.keys()]
      .sort((a, b) => b.length - a.length)
      .filter((candidate) => headingTail.includes(candidate));
    const exactGroup = result.recommendations.find((option) => {
      const optionCodes = option.plotCodes.map((code) => code.toUpperCase());
      return (
        optionCodes.length === headingCodes.length &&
        optionCodes.every((code) => headingCodes.includes(code))
      );
    });
    addOption(exactGroup);
  }
  if (ordered.length < desiredCount) {
    // Safe fallback for single-plot options only. Multi-plot candidate pools
    // commonly overlap by one code, so selecting them from an isolated mention
    // could bind the narrative to the wrong adjacent group.
    const mentions = result.recommendations
      .filter((option) => option.plotCodes.length === 1)
      .map((option) => ({
        option,
        index: upperContent.indexOf(option.plotCodes[0].toUpperCase()),
      }))
      .filter((item) => item.index >= 0)
      .sort((a, b) => a.index - b.index);
    for (const mention of mentions) {
      addOption(mention.option);
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
