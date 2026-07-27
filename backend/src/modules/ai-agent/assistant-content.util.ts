const INLINE_JSON_BLOCK = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
const INLINE_JSON_OBJECT = /\{[\s\S]*?\}/g;

export interface InlineRecommendationCall {
  args: Record<string, unknown>;
  raw: string;
}

function parseRecommendationArgs(
  rawJson: string,
): Record<string, unknown> | null {
  try {
    const value = JSON.parse(rawJson) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const args = value as Record<string, unknown>;
    const budgetMax = Number(args.budgetMax);
    const numberOfPlots = Number(args.numberOfPlots);
    if (
      !Number.isFinite(budgetMax) ||
      budgetMax <= 0 ||
      !Number.isInteger(numberOfPlots) ||
      numberOfPlots <= 0
    ) {
      return null;
    }
    return args;
  } catch {
    return null;
  }
}

export function extractInlineRecommendationCall(
  content: string | null,
): InlineRecommendationCall | null {
  if (!content) return null;

  for (const match of content.matchAll(INLINE_JSON_BLOCK)) {
    const args = parseRecommendationArgs(match[1]);
    if (args) return { args, raw: match[0] };
  }
  for (const match of content.matchAll(INLINE_JSON_OBJECT)) {
    const args = parseRecommendationArgs(match[0]);
    if (args) return { args, raw: match[0] };
  }
  return null;
}

export function inlineRecommendationLimitMessage(numberOfPlots: number) {
  return `Mỗi lần mình có thể tìm tối đa 10 lô để kết quả đủ chính xác và dễ so sánh. Bạn đang yêu cầu ${numberOfPlots} lô; bạn muốn mình tìm trước 10 lô phù hợp nhất hay giảm số lượng?`;
}

export function isIncompleteProgressMessage(content: string) {
  return /(?:đang|sẽ)\s+tìm kiếm|xin\s+(?:vui lòng\s+)?chờ|vui lòng\s+chờ/i.test(
    content,
  );
}
