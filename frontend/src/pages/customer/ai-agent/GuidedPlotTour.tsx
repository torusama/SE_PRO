import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Eye,
  GitCompareArrows,
  MapPinned,
  Pause,
  Play,
  RefreshCcw,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react'
import type { AgentRecommendation } from './agent.types'
import GuidedTourMap from './GuidedTourMap'
import {
  INITIAL_GUIDED_TOUR_STATE,
  buildGuidedTourSteps,
  getRecommendationStepIndex,
  getStepRecommendationIndex,
  getTourKeyboardCommand,
  getTourableRecommendations,
  guidedTourReducer,
} from './guidedTour'
import './GuidedPlotTour.css'

interface GuidedPlotTourProps {
  open: boolean
  recommendations: AgentRecommendation[]
  comparedIds: string[]
  onClose: () => void
  onToggleCompare: (option: AgentRecommendation) => void
  onStartRequest: (option: AgentRecommendation) => void
  onOpenFullMap: (option: AgentRecommendation) => void
}

interface TourNarrationProps {
  text: string
  revealed: boolean
  reducedMotion: boolean
  onComplete: () => void
}

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

function TourNarration({
  text,
  revealed,
  reducedMotion,
  onComplete,
}: TourNarrationProps) {
  const [visibleLength, setVisibleLength] = useState(() =>
    reducedMotion ? text.length : 0,
  )

  useEffect(() => {
    if (reducedMotion || revealed) {
      const completeTimer = window.setTimeout(onComplete, 0)
      return () => window.clearTimeout(completeTimer)
    }
    const charsPerTick = Math.max(2, Math.ceil(text.length / 90))
    const timer = window.setInterval(() => {
      setVisibleLength((current) => {
        const next = Math.min(text.length, current + charsPerTick)
        if (next >= text.length) {
          window.clearInterval(timer)
          onComplete()
        }
        return next
      })
    }, 24)
    return () => window.clearInterval(timer)
  }, [onComplete, reducedMotion, revealed, text.length])

  const renderedLength = revealed ? text.length : visibleLength

  return (
    <p className="guided-tour-narration">
      {text.slice(0, renderedLength)}
      {renderedLength < text.length && <span aria-hidden="true" />}
    </p>
  )
}

export default function GuidedPlotTour({
  open,
  recommendations,
  comparedIds,
  onClose,
  onToggleCompare,
  onStartRequest,
  onOpenFullMap,
}: GuidedPlotTourProps) {
  const validRecommendations = useMemo(
    () => getTourableRecommendations(recommendations),
    [recommendations],
  )
  const steps = useMemo(
    () => buildGuidedTourSteps(validRecommendations),
    [validRecommendations],
  )
  const [state, dispatch] = useReducer(
    guidedTourReducer,
    INITIAL_GUIDED_TOUR_STATE,
  )
  const [revealedStepId, setRevealedStepId] = useState<string | null>(
    null,
  )
  const reducedMotion = useReducedMotion()
  const activeStep = steps[state.activeStepIndex]
  const activeRecommendation =
    validRecommendations[state.activeRecommendationIndex] ??
    validRecommendations[0]

  useEffect(() => {
    if (open && steps.length) dispatch({ type: 'open' })
    if (!open) dispatch({ type: 'close' })
  }, [open, steps.length])

  const completeTyping = useCallback(() => {
    dispatch({ type: 'typing', value: false })
  }, [])

  const goToStep = useCallback(
    (index: number) => {
      const safeIndex = Math.min(Math.max(index, 0), steps.length - 1)
      const recommendationIndex = getStepRecommendationIndex(
        steps[safeIndex],
        state.activeRecommendationIndex,
      )
      dispatch({
        type: 'set-step',
        index: safeIndex,
        recommendationIndex,
      })
    },
    [state.activeRecommendationIndex, steps],
  )

  const nextStep = useCallback(() => {
    if (state.activeStepIndex >= steps.length - 1) {
      dispatch({ type: 'pause' })
      return
    }
    goToStep(state.activeStepIndex + 1)
  }, [goToStep, state.activeStepIndex, steps.length])

  const previousStep = useCallback(() => {
    goToStep(state.activeStepIndex - 1)
  }, [goToStep, state.activeStepIndex])

  useEffect(() => {
    if (
      !open ||
      state.isTyping ||
      !state.isPlaying ||
      !state.autoAdvance ||
      state.isUserControllingMap
    ) {
      return
    }
    const timer = window.setTimeout(nextStep, reducedMotion ? 900 : 1800)
    return () => window.clearTimeout(timer)
  }, [
    nextStep,
    open,
    reducedMotion,
    state.autoAdvance,
    state.isPlaying,
    state.isTyping,
    state.isUserControllingMap,
  ])

  useEffect(() => {
    if (!open) return
    const handleKeyboard = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return
      }
      const command = getTourKeyboardCommand(event.key, state.isPlaying)
      if (!command) return
      event.preventDefault()
      if (command === 'close') onClose()
      if (command === 'next') nextStep()
      if (command === 'previous') previousStep()
      if (command === 'toggle-play') {
        dispatch({ type: state.isPlaying ? 'pause' : 'play' })
      }
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [
    nextStep,
    onClose,
    open,
    previousStep,
    state.isPlaying,
  ])

  if (!open || !activeStep || !activeRecommendation) return null

  const progress = ((state.activeStepIndex + 1) / steps.length) * 100
  const selectedForCompare = comparedIds.includes(
    activeRecommendation.optionId,
  )

  function selectRecommendation(index: number) {
    dispatch({
      type: 'select-recommendation',
      index,
      stepIndex: getRecommendationStepIndex(steps, index),
    })
  }

  return (
    <section
      className="guided-tour-shell"
      aria-label="Tour giới thiệu lô đất"
    >
      <div className="guided-tour-narrative-panel">
        <header className="guided-tour-header">
          <div>
            <span>
              <Sparkles size={14} />
              AI ĐANG TƯ VẤN TRÊN BẢN ĐỒ
            </span>
            <h2>Cùng xem vị trí phù hợp cho gia đình</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Thoát tour">
            <X size={20} />
          </button>
        </header>

        <div
          className="guided-tour-live"
          aria-live="polite"
          aria-atomic="true"
        >
          Bước {state.activeStepIndex + 1} trên {steps.length}. Phương án{' '}
          {state.activeRecommendationIndex + 1}.
        </div>

        <div className="guided-tour-copy">
          <span className="guided-tour-step-label">
            BƯỚC {state.activeStepIndex + 1}/{steps.length}
          </span>
          <TourNarration
            key={activeStep.id}
            text={activeStep.narration}
            revealed={revealedStepId === activeStep.id}
            reducedMotion={reducedMotion}
            onComplete={completeTyping}
          />
        </div>

        <div className="guided-tour-options" aria-label="Các phương án">
          {validRecommendations.map((option, index) => (
            <button
              type="button"
              key={option.optionId}
              className={
                index === state.activeRecommendationIndex
                  ? 'is-active'
                  : ''
              }
              aria-pressed={index === state.activeRecommendationIndex}
              onClick={() => selectRecommendation(index)}
            >
              <span>{index + 1}</span>
              <div>
                <strong>{option.plotCodes.join(' · ')}</strong>
                <small>
                  {option.zoneName} · {money(option.estimatedTotal)}
                </small>
              </div>
              {index === state.activeRecommendationIndex && (
                <Check size={15} />
              )}
            </button>
          ))}
        </div>

        <div className="guided-tour-actions">
          <button
            type="button"
            onClick={() => onOpenFullMap(activeRecommendation)}
          >
            <ExternalLink size={15} />
            Mở bản đồ đầy đủ
          </button>
          <button
            type="button"
            className={selectedForCompare ? 'is-selected' : ''}
            onClick={() => onToggleCompare(activeRecommendation)}
          >
            <GitCompareArrows size={15} />
            {selectedForCompare ? 'Đã chọn so sánh' : 'Thêm so sánh'}
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={() => onStartRequest(activeRecommendation)}
          >
            Đặt yêu cầu
          </button>
        </div>

        <div className="guided-tour-controls">
          <div className="guided-tour-progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <div>
            <button
              type="button"
              onClick={() => {
                setRevealedStepId(null)
                dispatch({ type: 'restart' })
              }}
              aria-label="Khởi động lại tour"
              title="Khởi động lại"
            >
              <RefreshCcw size={17} />
            </button>
            <button
              type="button"
              onClick={previousStep}
              disabled={state.activeStepIndex === 0}
              aria-label="Bước trước"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              className="guided-tour-play"
              onClick={() =>
                dispatch({ type: state.isPlaying ? 'pause' : 'play' })
              }
              aria-label={state.isPlaying ? 'Tạm dừng tour' : 'Tiếp tục tour'}
            >
              {state.isPlaying ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              onClick={nextStep}
              disabled={state.activeStepIndex === steps.length - 1}
              aria-label="Bước tiếp theo"
            >
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                setRevealedStepId(activeStep.id)
                dispatch({ type: 'typing', value: false })
              }}
              disabled={!state.isTyping}
              aria-label="Hiện toàn bộ lời giới thiệu"
              title="Hiện toàn bộ nội dung"
            >
              <SkipForward size={17} />
            </button>
          </div>
          <label>
            <input
              type="checkbox"
              checked={state.autoAdvance}
              onChange={() => dispatch({ type: 'toggle-auto' })}
            />
            Tự chuyển bước
          </label>
        </div>
      </div>

      <div className="guided-tour-map-panel">
        <div className="guided-tour-map-heading">
          <MapPinned size={15} />
          <span>
            <small>BẢN ĐỒ TƯ VẤN TRỰC QUAN</small>
            <strong>
              Đang tập trung: {activeRecommendation.plotCodes.join(' · ')}
            </strong>
          </span>
        </div>
        <GuidedTourMap
          activeStep={activeStep}
          reducedMotion={reducedMotion}
          onUserInteraction={() => dispatch({ type: 'user-interaction' })}
          onCameraAnimatingChange={(value) =>
            dispatch({ type: 'camera', value })
          }
        />
        <aside className="guided-tour-info-card">
          <span>PHƯƠNG ÁN {state.activeRecommendationIndex + 1}</span>
          <h3>{activeRecommendation.plotCodes.join(' · ')}</h3>
          <div>
            <p>
              <small>Khu vực</small>
              <strong>{activeRecommendation.zoneName}</strong>
            </p>
            <p>
              <small>Hướng</small>
              <strong>
                {activeRecommendation.directions.join(', ') ||
                  'Chưa xác định'}
              </strong>
            </p>
            <p>
              <small>Diện tích</small>
              <strong>{activeRecommendation.totalAreaSqm || 0} m²</strong>
            </p>
            <p>
              <small>Mức phù hợp</small>
              <strong>
                {Math.round(activeRecommendation.score * 100)}%
              </strong>
            </p>
          </div>
          <footer>
            <span>
              {activeRecommendation.isAdjacent
                ? `${activeRecommendation.plotIds.length} lô liền kề`
                : `${activeRecommendation.plotIds.length} lô`}
            </span>
            <strong>{money(activeRecommendation.estimatedTotal)}</strong>
          </footer>
        </aside>

        {state.isUserControllingMap && (
          <button
            type="button"
            className="guided-tour-resume"
            onClick={() => dispatch({ type: 'resume' })}
          >
            <Eye size={16} />
            Tiếp tục tour tự động
          </button>
        )}
      </div>
    </section>
  )
}
