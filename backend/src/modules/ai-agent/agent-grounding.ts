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
  if (
    !result.baziSuggestion &&
    /\b(?:bazi|phong\s*thủy|may\s*mắn|tài\s*lộc|vượng)\b/i.test(content)
  ) {
    return false;
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
