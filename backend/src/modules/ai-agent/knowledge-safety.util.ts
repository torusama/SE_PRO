export function foldKnowledgeText(content: string) {
  return content
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Knowledge can describe the product, but it must not become a second runtime
 * configuration channel. These claims require a real backend/admin workflow,
 * not an LLM-generated or chat-approved record.
 */
export function isRuntimeOperationalClaim(content: string) {
  const folded = foldKnowledgeText(content);
  return (
    /\b(?:giu cho|dat cho|reservation)\b.{0,100}\b(?:phut|gio|ngay|tuan|thang|toi da|het han)\b/.test(
      folded,
    ) ||
    /\b(?:giam|discount)\b.{0,50}\d+\s*%/.test(folded) ||
    /\b(?:khong can|mien|bo qua)\b.{0,60}\b(?:thanh toan|dat coc|prepay|payment|deposit)\b/.test(
      folded,
    ) ||
    /\b(?:thanh toan|dat coc|prepay|payment|deposit)\b.{0,60}\b(?:khong can|mien|bo qua)\b/.test(
      folded,
    ) ||
    /\b(?:vip|khach hang|customer)\b.{0,80}\b(?:uu tien|priority)\b.{0,80}\b(?:lo|plot|vi tri|location)\b/.test(
      folded,
    ) ||
    /\b(?:mien phi|free)\b.{0,60}\b(?:dich vu|service|ve sinh|cham soc)\b/.test(
      folded,
    ) ||
    /\b(?:dat|doi|sua|cap nhat|thay|ap dung)\b.{0,50}\b(?:gia|price)\b/.test(
      folded,
    ) ||
    /\b(?:gia|price)\b.{0,60}\b(?:tat ca|toan bo|moi)\s+(?:cac\s+)?(?:lo|plot|dich vu|service)\b/.test(
      folded,
    ) ||
    /\b(?:dat|doi|sua|cap nhat|thay)\b.{0,50}\b(?:trang thai|status)\b.{0,80}\b(?:lo|plot|don|order|giao dich|transaction)\b/.test(
      folded,
    ) ||
    /\b(?:role|quyen|phan quyen|admin|jwt|timeout|api key|cau hinh)\b/.test(
      folded,
    )
  );
}
