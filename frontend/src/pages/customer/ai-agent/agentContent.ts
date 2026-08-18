import { repairAgentDisplayText } from './agentDisplay'

const INTERNAL_TOOL_BLOCK =
  /```(?:json)?\s*(\{[\s\S]*?"budgetMax"[\s\S]*?"numberOfPlots"[\s\S]*?\})\s*```/gi

export function sanitizeAgentDisplayContent(content: string) {
  let requestedPlots: number | undefined
  let foundInternalPayload = false
  const normalized = repairAgentDisplayText(content)
  const cleaned = normalized
    .replace(INTERNAL_TOOL_BLOCK, (_block, json: string) => {
      foundInternalPayload = true
      try {
        const parsed = JSON.parse(json) as { numberOfPlots?: unknown }
        const count = Number(parsed.numberOfPlots)
        if (Number.isInteger(count) && count > 0) requestedPlots = count
      } catch {
        // Hide malformed blocks too: they still expose internal tool syntax.
      }
      return ''
    })
    .trim()

  if (!foundInternalPayload) return normalized
  if (requestedPlots !== undefined && requestedPlots > 10) {
    return `Mỗi lần mình có thể tìm tối đa 10 lô để kết quả đủ chính xác và dễ so sánh. Bạn đang yêu cầu ${requestedPlots} lô; bạn muốn mình tìm trước 10 lô phù hợp nhất hay giảm số lượng?`
  }
  if (/đang tìm kiếm|xin chờ/i.test(cleaned)) {
    return 'Yêu cầu tra cứu trước chưa hoàn tất. Bạn vui lòng gửi lại để mình kiểm tra dữ liệu lô mới nhất.'
  }
  return (
    cleaned ||
    'Bạn vui lòng gửi lại yêu cầu để mình kiểm tra dữ liệu lô mới nhất.'
  )
}
