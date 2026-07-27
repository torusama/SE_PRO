import type { AgentRecommendation } from './agent.types'

export type GuidedTourStepType =
  | 'overview'
  | 'plot-focus'
  | 'plot-details'
  | 'comparison'
  | 'summary'

export interface GuidedTourStep {
  id: string
  type: GuidedTourStepType
  recommendationIndex?: number
  plotIds: number[]
  narration: string
  cameraMode: 'overview' | 'single-plot' | 'plot-group' | 'keep-current'
  durationMs: number
}

export interface GuidedTourState {
  isOpen: boolean
  isPlaying: boolean
  autoAdvance: boolean
  activeStepIndex: number
  activeRecommendationIndex: number
  isTyping: boolean
  isCameraAnimating: boolean
  isUserControllingMap: boolean
}

export type GuidedTourAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle-auto' }
  | { type: 'next'; maxIndex: number; recommendationIndex: number }
  | { type: 'previous'; recommendationIndex: number }
  | { type: 'set-step'; index: number; recommendationIndex: number }
  | { type: 'select-recommendation'; index: number; stepIndex: number }
  | { type: 'typing'; value: boolean }
  | { type: 'camera'; value: boolean }
  | { type: 'user-interaction' }
  | { type: 'resume' }
  | { type: 'restart' }

export const INITIAL_GUIDED_TOUR_STATE: GuidedTourState = {
  isOpen: false,
  isPlaying: false,
  autoAdvance: true,
  activeStepIndex: 0,
  activeRecommendationIndex: 0,
  isTyping: false,
  isCameraAnimating: false,
  isUserControllingMap: false,
}

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)

export function getRecommendationPlotIds(option: AgentRecommendation) {
  return [
    ...new Set(
      [...option.highlightPlotIds, ...option.plotIds].filter(
        (id) => Number.isInteger(id) && id > 0,
      ),
    ),
  ]
}

export function isTourableRecommendation(option: AgentRecommendation) {
  return getRecommendationPlotIds(option).length > 0
}

export function getTourableRecommendations(
  recommendations: AgentRecommendation[],
) {
  return recommendations.filter(isTourableRecommendation)
}

export function buildGuidedTourSteps(
  recommendations: AgentRecommendation[],
): GuidedTourStep[] {
  const valid = getTourableRecommendations(recommendations)
  if (!valid.length) return []

  const steps: GuidedTourStep[] = [
    {
      id: 'tour-overview',
      type: 'overview',
      plotIds: valid.flatMap(getRecommendationPlotIds),
      narration: `Mình đã chọn lọc ${valid.length} phương án từ quỹ đất hiện có. Chúng ta sẽ lần lượt xem vị trí, mức độ phù hợp và chi phí dự kiến để gia đình dễ cân nhắc.`,
      cameraMode: 'overview',
      durationMs: 1200,
    },
  ]

  valid.forEach((option, index) => {
    const plotIds = getRecommendationPlotIds(option)
    const codes = option.plotCodes.join(', ')
    const strengths = option.reasons
      .slice(0, 2)
      .map((reason) => reason.replace(/[.。]+$/, ''))
      .join('. ')
    const consideration = option.tradeOffs[0]
      ? `Điểm gia đình nên cân nhắc là ${option.tradeOffs[0].replace(/[.。]+$/, '')}.`
      : 'Hiện phương án này không có điểm đánh đổi đáng kể trong các tiêu chí đã cung cấp.'
    steps.push(
      {
        id: `option-${option.optionId}-focus`,
        type: 'plot-focus',
        recommendationIndex: index,
        plotIds,
        narration: `Đây là phương án ${index + 1}: ${codes}, thuộc ${option.zoneName || 'khu đang mở bán'}. ${option.isAdjacent ? `Nhóm ${plotIds.length} lô nằm liền kề, thuận tiện quy hoạch không gian gia đình.` : 'Vị trí được chọn riêng theo các tiêu chí bạn đã cung cấp.'}`,
        cameraMode: plotIds.length > 1 ? 'plot-group' : 'single-plot',
        durationMs: 1100,
      },
      {
        id: `option-${option.optionId}-details`,
        type: 'plot-details',
        recommendationIndex: index,
        plotIds,
        narration: `Phương án đạt mức phù hợp ${Math.round(option.score * 100)}%, diện tích ${option.totalAreaSqm || 0} m²${option.directions.length ? `, hướng ${option.directions.join(', ')}` : ''}. Chi phí lô là ${money(option.plotCost)} và tổng dự kiến ${money(option.estimatedTotal)}. ${strengths ? `Điểm nổi bật: ${strengths}. ` : ''}${consideration}`,
        cameraMode: 'keep-current',
        durationMs: 900,
      },
    )
  })

  if (valid.length > 1) {
    steps.push({
      id: 'tour-comparison',
      type: 'comparison',
      plotIds: valid.flatMap(getRecommendationPlotIds),
      narration:
        'Bây giờ mình thu toàn cảnh để gia đình so sánh vị trí giữa các phương án. Bạn có thể chọn lại từng phương án, đưa vào bảng so sánh hoặc mở bản đồ đầy đủ để xem chi tiết.',
      cameraMode: 'overview',
      durationMs: 1200,
    })
  }

  steps.push({
    id: 'tour-summary',
    type: 'summary',
    recommendationIndex: 0,
    plotIds: getRecommendationPlotIds(valid[0]),
    narration:
      'Bạn đã xem hết phần giới thiệu. Nếu đã có phương án ưng ý, mình có thể hỏi thêm thông tin cần thiết, đọc lại nội dung để bạn xác nhận rồi gửi yêu cầu thay bạn.',
    cameraMode: 'keep-current',
    durationMs: 800,
  })

  return steps
}

export function getStepRecommendationIndex(
  step: GuidedTourStep | undefined,
  fallback = 0,
) {
  return step?.recommendationIndex ?? fallback
}

export function getRecommendationStepIndex(
  steps: GuidedTourStep[],
  recommendationIndex: number,
) {
  const index = steps.findIndex(
    (step) =>
      step.recommendationIndex === recommendationIndex &&
      step.type === 'plot-focus',
  )
  return index >= 0 ? index : 0
}

export function guidedTourReducer(
  state: GuidedTourState,
  action: GuidedTourAction,
): GuidedTourState {
  switch (action.type) {
    case 'open':
      return {
        ...INITIAL_GUIDED_TOUR_STATE,
        isOpen: true,
        isPlaying: true,
        isTyping: true,
      }
    case 'close':
      return INITIAL_GUIDED_TOUR_STATE
    case 'play':
      return {
        ...state,
        isPlaying: true,
        isUserControllingMap: false,
      }
    case 'pause':
      return { ...state, isPlaying: false }
    case 'toggle-auto':
      return { ...state, autoAdvance: !state.autoAdvance }
    case 'next':
      return {
        ...state,
        activeStepIndex: Math.min(state.activeStepIndex + 1, action.maxIndex),
        activeRecommendationIndex: action.recommendationIndex,
        isTyping: true,
        isUserControllingMap: false,
      }
    case 'previous':
      return {
        ...state,
        activeStepIndex: Math.max(state.activeStepIndex - 1, 0),
        activeRecommendationIndex: action.recommendationIndex,
        isTyping: true,
        isUserControllingMap: false,
      }
    case 'set-step':
      return {
        ...state,
        activeStepIndex: Math.max(0, action.index),
        activeRecommendationIndex: action.recommendationIndex,
        isTyping: true,
        isUserControllingMap: false,
      }
    case 'select-recommendation':
      return {
        ...state,
        activeRecommendationIndex: action.index,
        activeStepIndex: action.stepIndex,
        isPlaying: false,
        isTyping: true,
        isUserControllingMap: false,
      }
    case 'typing':
      return { ...state, isTyping: action.value }
    case 'camera':
      return { ...state, isCameraAnimating: action.value }
    case 'user-interaction':
      return {
        ...state,
        isPlaying: false,
        isCameraAnimating: false,
        isUserControllingMap: true,
      }
    case 'resume':
      return {
        ...state,
        isPlaying: true,
        isUserControllingMap: false,
      }
    case 'restart':
      return {
        ...state,
        activeStepIndex: 0,
        activeRecommendationIndex: 0,
        isPlaying: true,
        isTyping: true,
        isUserControllingMap: false,
      }
    default:
      return state
  }
}

export function getTourKeyboardCommand(
  key: string,
  isPlaying: boolean,
): 'toggle-play' | 'next' | 'previous' | 'close' | null {
  if (key === ' ') return 'toggle-play'
  if (key === 'ArrowRight') return 'next'
  if (key === 'ArrowLeft') return 'previous'
  if (key === 'Escape') return 'close'
  return isPlaying ? null : null
}

export function getCameraDuration(
  requestedDurationMs: number,
  reducedMotion: boolean,
) {
  return reducedMotion ? 0 : Math.min(1600, Math.max(800, requestedDurationMs))
}

export function buildFullMapUrl(
  baseRoute: string,
  option: AgentRecommendation,
) {
  const params = new URLSearchParams()
  params.set('highlight', getRecommendationPlotIds(option).join(','))
  params.set('recommendation', option.optionId)
  return `${baseRoute}?${params.toString()}`
}
