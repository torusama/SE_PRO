import {
  CEMETERY_ZONE_LAYOUT,
  getCemeteryZoneCode,
} from "@/lib/cemeteryMapLayout";
import type { AgentRecommendation } from "./agent.types";

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/Khu A\s*(?:â€”|—|-)\s*Cao Cáº¥p/gi, "Khu A - Cao cấp"],
  [/Khu B\s*(?:â€”|—|-)\s*TiÃªu Chuáº©n/gi, "Khu B - Tiêu chuẩn"],
  [/Khu C\s*(?:â€”|—|-)\s*Gia ÄÃ¬nh/gi, "Khu C - Gia đình"],
  [/Khu D\s*(?:â€”|—|-)\s*BÃ¬nh DÃ¢n/gi, "Khu D - Bình dân"],
  [/â€”|â€“|Ã¢â‚¬â€|Ã¢â‚¬â€œ/g, "—"],
  [/Â|Ã‚/g, ""],
  [/Ä‘/g, "đ"],
  [/Ä/g, "Đ"],
  [/Cáº¥p/g, "Cấp"],
  [/TiÃªu/g, "Tiêu"],
  [/Chuáº©n/g, "Chuẩn"],
  [/Gia ÄÃ¬nh/g, "Gia Đình"],
  [/BÃ¬nh/g, "Bình"],
  [/DÃ¢n/g, "Dân"],
  [/TÃ¢y|TÃƒÂ¢y/g, "Tây"],
  [/Báº¯c|BÃ¡ÂºÂ¯c/g, "Bắc"],
  [/Ä.?Ã´ng|Ã„.?ÃƒÂ´ng/g, "Đông"],
  [/â‚«|â‚¬|¤/g, "VND"],
];

export function repairAgentDisplayText(value?: string | null) {
  let text = value ?? "";
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

export function cleanAgentDisplayText(value?: string | null) {
  return repairAgentDisplayText(value).replace(/\s+/g, " ").trim();
}

export function getRecommendationZoneName(option: AgentRecommendation) {
  const plotCode = option.plotCodes[0] ?? "";
  const cleanZone = cleanAgentDisplayText(option.zoneName);
  const zoneCode = getCemeteryZoneCode(plotCode, undefined, cleanZone);
  return CEMETERY_ZONE_LAYOUT[zoneCode]?.name || cleanZone || "Chưa xác định";
}

export function formatVnd(value: number) {
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(value)} VND`;
}

export function getRecommendationCompareKey(option: AgentRecommendation) {
  const ids = [...new Set(option.plotIds)]
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((left, right) => left - right);
  if (ids.length) return `plots:${ids.join("-")}`;
  return `codes:${[...option.plotCodes].sort().join("|")}`;
}

export function formatSuitabilityScore(score: number) {
  const percentage = Math.max(0, Math.min(100, score * 100));
  return `${percentage.toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}
