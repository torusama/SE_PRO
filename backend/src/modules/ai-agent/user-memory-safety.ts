import type { UserMemoryKey } from './tools/agent-tool.types';

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s:/.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Durable memory must have evidence that it should survive the current task.
 * Stable identity facts are reusable by nature; all other preferences need a
 * remembered/future/default/habit/preference cue in either the source sentence
 * or the planner's bounded paraphrase.
 */
export function hasDurableUserMemoryEvidence(
  memoryKey: UserMemoryKey,
  sourceMessage: string,
  proposedContent: string,
) {
  if (['birth_date', 'birth_time', 'birth_gender'].includes(memoryKey)) {
    return true;
  }
  const value = fold(`${sourceMessage} ${proposedContent}`);
  return /\b(?:remember|please remember|save this|from now on|in future|next time|always|usually|normally|default|prefer|prefers|preference|like|likes|ghi nho|nho giup|hay nho|luu lai|luu giup|tu gio|sau nay|ve sau|lan sau|nhung lan sau|cac lan sau|trong tuong lai|luon|thuong|thuong xuyen|mac dinh|uu tien|thich)\b/.test(
    value,
  );
}

/** Reject a planner proposal whose stable key is incompatible with its value. */
export function isUserMemoryContentCompatible(
  memoryKey: UserMemoryKey,
  content: string,
) {
  const value = fold(content);
  if (!value) return false;

  switch (memoryKey) {
    case 'preferred_direction':
      // Requiring a compass value avoids confusing "thắp hương" with "hướng".
      return /\b(?:dong|tay|nam|bac)(?:\s+(?:dong|tay|nam|bac))?\b/.test(value);
    case 'preferred_zone':
      return /\b(?:khu|zone)\s+[a-z0-9][a-z0-9_-]*\b/.test(value);
    case 'maximum_budget':
    case 'minimum_budget':
      return (
        /\b\d[\d.,]*\s*(?:trieu|ty|vnd|dong|million|billion)\b/.test(value) ||
        /\b(?:budget|ngan sach|toi da|toi thieu|maximum|minimum)\b/.test(value)
      );
    case 'adjacent_plot_count':
      return /\b(?:lien ke|lien nhau|canh nhau|ke nhau|adjacent)\b/.test(value);
    case 'preferred_plot_type':
      return /\b(?:lo don|lo doi|lo gia dinh|gia dinh|dong ho|dong toc|single|double|family|plot type)\b/.test(
        value,
      );
    case 'preferred_plot_location':
      return /\b(?:gan cong|sat cong|yen tinh|it nguoi|it xe|thoang mat|cay xanh|vi tri|location|near the entrance|quiet(?:er|est)?|entrance|gate|zone)\b/.test(
        value,
      );
    case 'accessibility_priority':
      return /\b(?:xe lan|de di lai|de tiep can|tiep can|wheelchair|accessible|accessibility)\b/.test(
        value,
      );
    case 'response_detail_preference':
      return /\b(?:ngan gon|chi tiet|tom tat|brief|concise|detail|detailed)\b/.test(
        value,
      );
    case 'service_interest':
      return /\b(?:dich vu|cham soc|don dep|thay hoa|thap huong|tuong niem|service|cleaning|flower|incense)\b/.test(
        value,
      );
    case 'consultation_topic_preference':
      return /\b(?:phong thuy|feng shui|fengshui|bazi|bat tu|am trach|van hoa|tam linh|consultation)\b/.test(
        value,
      );
    case 'birth_date':
      return /\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(
        value,
      );
    case 'birth_time':
      return /\b(?:[01]?\d|2[0-3])(?::\d{2}|h\d{0,2})\b/.test(value);
    case 'birth_gender':
      return /\b(?:nam|nu|male|female)\b/.test(value);
    default:
      return false;
  }
}

export function isSafeActiveUserMemory(input: {
  memoryKey: string | null;
  content: string;
}) {
  if (!input.memoryKey) return false;
  const key = input.memoryKey as UserMemoryKey;
  return (
    isUserMemoryContentCompatible(key, input.content) &&
    hasDurableUserMemoryEvidence(key, input.content, input.content)
  );
}
