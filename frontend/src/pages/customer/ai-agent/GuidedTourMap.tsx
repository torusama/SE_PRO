import { LocateFixed, ZoomIn, ZoomOut } from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { API_BASE_URL } from '@/lib/api'
import { getCemeteryRoutePoints } from '@/lib/cemeteryMapRoute'
import {
  CLUSTER_GROUP_BACKDROPS,
  CONNECTOR_ROAD,
  CROSS_ROADS,
  LEFT_DIAGONAL_ROAD_POINTS,
  MAIN_ROAD,
  MAP_BG_RECT,
  MAP_BOUNDARY_POINTS,
  MAP_GATE,
  SECONDARY_GATE,
  SPIRIT_PARK,
  ZONE_BACKDROPS,
  gateMarkerPoints,
} from '@/lib/cemeteryMapVisuals'
import type { GuidedTourStep } from './guidedTour'
import {
  getCameraForPlots,
  getCameraForRoute,
  mapTourPlot,
  OVERVIEW_CAMERA,
  type BackendMapPlot,
  type CameraState,
  type GuidedTourPlot,
  type PlotStatus,
} from './guidedTourMapModel'

interface GuidedTourMapProps {
  activeStep: GuidedTourStep
  reducedMotion: boolean
  onUserInteraction: () => void
  onCameraAnimatingChange: (value: boolean) => void
  onPlotSelect?: (plot: GuidedTourPlot) => void
  onFocusedPlotsChange?: (plots: GuidedTourPlot[]) => void
  routePlot?: GuidedTourPlot | null
}

const STATUS_COLOR: Record<PlotStatus, string> = {
  available: '#138a78',
  pending: '#c29a42',
  reserved: '#7b6bcc',
  sold: '#52616b',
  locked: '#8b4a53',
}

const easeInOut = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2

function GuidedTourMap({
  activeStep,
  reducedMotion,
  onUserInteraction,
  onCameraAnimatingChange,
  onPlotSelect,
  onFocusedPlotsChange,
  routePlot,
}: GuidedTourMapProps) {
  const [plots, setPlots] = useState<GuidedTourPlot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [camera, setCamera] = useState<CameraState>(OVERVIEW_CAMERA)
  const cameraRef = useRef(camera)
  const frameRef = useRef<number | undefined>(undefined)
  const pointerRef = useRef<
    | {
        pointerId: number
        startX: number
        startY: number
        camera: CameraState
      }
    | undefined
  >(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/plots/map`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<
          BackendMapPlot[] | { data?: BackendMapPlot[] }
        >
      })
      .then((payload) => {
        const rows = Array.isArray(payload) ? payload : (payload.data ?? [])
        setPlots(
          rows
            .map(mapTourPlot)
            .filter((plot): plot is GuidedTourPlot => plot !== null),
        )
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') {
          setLoadError('Chưa tải được dữ liệu bản đồ.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [reloadKey])

  const activeIds = useMemo(
    () => new Set(activeStep.plotIds),
    [activeStep.plotIds],
  )
  const activePlots = useMemo(
    () => plots.filter((plot) => activeIds.has(plot.id)),
    [activeIds, plots],
  )

  useEffect(() => {
    onFocusedPlotsChange?.(activePlots)
  }, [activePlots, onFocusedPlotsChange])

  const cancelAnimation = useCallback(() => {
    if (frameRef.current !== undefined) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = undefined
    }
    onCameraAnimatingChange(false)
  }, [onCameraAnimatingChange])

  const animateTo = useCallback(
    (target: CameraState, duration: number) => {
      cancelAnimation()
      if (reducedMotion || duration <= 0) {
        frameRef.current = window.requestAnimationFrame(() => {
          const next = { ...target, rotation: 0 }
          cameraRef.current = next
          setCamera(next)
          frameRef.current = undefined
          onCameraAnimatingChange(false)
        })
        return
      }
      const start = cameraRef.current
      const startedAt = performance.now()
      onCameraAnimatingChange(true)
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration)
        const eased = easeInOut(progress)
        const next = {
          x: start.x + (target.x - start.x) * eased,
          y: start.y + (target.y - start.y) * eased,
          width: start.width + (target.width - start.width) * eased,
          height: start.height + (target.height - start.height) * eased,
          rotation: 0,
        }
        cameraRef.current = next
        setCamera(next)
        if (progress < 1) {
          frameRef.current = window.requestAnimationFrame(tick)
        } else {
          frameRef.current = undefined
          onCameraAnimatingChange(false)
        }
      }
      frameRef.current = window.requestAnimationFrame(tick)
    },
    [cancelAnimation, onCameraAnimatingChange, reducedMotion],
  )

  useEffect(() => {
    if (loading) return
    if (activeStep.cameraMode === 'keep-current') return
    animateTo(
      routePlot
        ? getCameraForRoute(routePlot)
        : getCameraForPlots(activePlots, activeStep),
      activeStep.durationMs,
    )
  }, [activePlots, activeStep, animateTo, loading, routePlot])

  useEffect(() => cancelAnimation, [cancelAnimation])

  function beginManualControl() {
    cancelAnimation()
    onUserInteraction()
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    beginManualControl()
    pointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      camera: cameraRef.current,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current
    const bounds = wrapRef.current?.getBoundingClientRect()
    if (!pointer || pointer.pointerId !== event.pointerId || !bounds) return
    const x =
      pointer.camera.x -
      ((event.clientX - pointer.startX) / bounds.width) * pointer.camera.width
    const y =
      pointer.camera.y -
      ((event.clientY - pointer.startY) / bounds.height) * pointer.camera.height
    setCamera({ ...pointer.camera, x, y })
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerRef.current?.pointerId === event.pointerId) {
      pointerRef.current = undefined
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault()
    beginManualControl()
    const factor = event.deltaY > 0 ? 1.14 : 0.86
    setCamera((current) => {
      const width = Math.min(
        OVERVIEW_CAMERA.width,
        Math.max(260, current.width * factor),
      )
      const height = Math.min(
        OVERVIEW_CAMERA.height,
        Math.max(240, current.height * factor),
      )
      return {
        ...current,
        x: current.x + (current.width - width) / 2,
        y: current.y + (current.height - height) / 2,
        width,
        height,
      }
    })
  }

  function zoom(factor: number) {
    beginManualControl()
    setCamera((current) => {
      const width = Math.min(
        OVERVIEW_CAMERA.width,
        Math.max(260, current.width * factor),
      )
      const height = Math.min(
        OVERVIEW_CAMERA.height,
        Math.max(240, current.height * factor),
      )
      return {
        ...current,
        x: current.x + (current.width - width) / 2,
        y: current.y + (current.height - height) / 2,
        width,
        height,
      }
    })
  }

  const activeMissing =
    !loading && activeStep.plotIds.length > 0 && activePlots.length === 0

  return (
    <div
      ref={wrapRef}
      className="guided-map"
      role="application"
      aria-label="Bản đồ tour lô đất tương tác"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <svg
        viewBox={`${camera.x} ${camera.y} ${camera.width} ${camera.height}`}
        aria-label="Sơ đồ nghĩa trang và các lô được đề xuất"
      >
        <defs>
          <filter id="tour-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern
            id="tour-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(116, 158, 164, .08)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <g>
          <rect {...MAP_BG_RECT} fill="#07101b" />
          <rect {...MAP_BG_RECT} fill="url(#tour-grid)" />
          <polygon
            points={MAP_BOUNDARY_POINTS}
            fill="rgba(0, 229, 196, .018)"
            stroke="rgba(0, 229, 196, .26)"
            strokeWidth="5"
            strokeDasharray="16 11"
          />
          {Object.entries(ZONE_BACKDROPS).map(([key, zone]) => (
            <polygon
              key={key}
              points={zone.points}
              fill="rgba(17, 35, 48, .82)"
              stroke="rgba(111, 151, 158, .24)"
              strokeWidth="3"
            />
          ))}
          {CLUSTER_GROUP_BACKDROPS.map((zone, index) => (
            <polygon
              key={index}
              points={zone.points}
              fill="rgba(35, 29, 62, .74)"
              stroke="rgba(123, 107, 204, .34)"
              strokeWidth="3"
            />
          ))}
          <polygon
            points={LEFT_DIAGONAL_ROAD_POINTS}
            fill="none"
            stroke="rgba(201, 168, 76, .3)"
            strokeWidth="12"
          />
          <rect {...MAIN_ROAD} fill="rgba(201, 168, 76, .13)" />
          {CROSS_ROADS.map((road, index) => (
            <rect key={index} {...road} fill="rgba(201, 168, 76, .09)" />
          ))}
          <rect {...CONNECTOR_ROAD} fill="rgba(201, 168, 76, .13)" />
          <rect
            x={SPIRIT_PARK.x}
            y={SPIRIT_PARK.y}
            width={SPIRIT_PARK.width}
            height={SPIRIT_PARK.height}
            rx="34"
            fill="rgba(0, 229, 196, .05)"
            stroke="rgba(0, 229, 196, .2)"
            strokeWidth="4"
          />
          <circle
            cx={SPIRIT_PARK.cx}
            cy={SPIRIT_PARK.cy}
            r={SPIRIT_PARK.r}
            fill="rgba(0, 229, 196, .07)"
          />
          <polygon points={gateMarkerPoints(MAP_GATE)} fill="#c9a84c" />
          <polygon points={gateMarkerPoints(SECONDARY_GATE)} fill="#7b6bcc" />
          {routePlot && (
            <>
              <polyline
                className="guided-map-route-shadow"
                points={getCemeteryRoutePoints(routePlot)}
              />
              <polyline
                className="guided-map-route"
                points={getCemeteryRoutePoints(routePlot)}
              />
              <circle
                className="guided-map-route-target"
                cx={routePlot.x + routePlot.width / 2}
                cy={routePlot.y + routePlot.height / 2}
                r="17"
              />
            </>
          )}
          {plots.map((plot) => {
            const active = activeIds.has(plot.id)
            return (
              <g
                key={plot.id}
                className={active ? 'is-tour-active' : ''}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  beginManualControl()
                  onPlotSelect?.(plot)
                }}
                role="button"
                aria-label={`${plot.plotCode}, ${plot.zoneName}, ${plot.status}`}
              >
                <rect
                  x={plot.x}
                  y={plot.y}
                  width={plot.width}
                  height={plot.height}
                  rx="4"
                  fill={STATUS_COLOR[plot.status]}
                  opacity={activeIds.size > 0 && !active ? 0.38 : 0.92}
                  stroke={active ? '#ecfffb' : 'rgba(232, 240, 244, .22)'}
                  strokeWidth={active ? 5 : 1.5}
                />
                {active && (
                  <rect
                    x={plot.x - 7}
                    y={plot.y - 7}
                    width={plot.width + 14}
                    height={plot.height + 14}
                    rx="10"
                    fill="none"
                    stroke="#00e5c4"
                    strokeWidth="7"
                    strokeDasharray="18 10"
                    filter="url(#tour-glow)"
                    className="guided-map-highlight"
                  />
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="guided-map-tools" aria-label="Điều khiển bản đồ">
        <button type="button" onClick={() => zoom(0.78)} aria-label="Phóng to">
          <ZoomIn size={17} />
        </button>
        <button type="button" onClick={() => zoom(1.24)} aria-label="Thu nhỏ">
          <ZoomOut size={17} />
        </button>
        <button
          type="button"
          onClick={() => {
            beginManualControl()
            setCamera(OVERVIEW_CAMERA)
          }}
          aria-label="Xem toàn cảnh"
        >
          <LocateFixed size={17} />
        </button>
      </div>

      {loading && <div className="guided-map-state">Đang tải bản đồ…</div>}
      {loadError && (
        <div className="guided-map-state is-error">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              setLoadError('')
              setReloadKey((key) => key + 1)
            }}
          >
            Thử lại
          </button>
        </div>
      )}
      {activeMissing && !loadError && (
        <div className="guided-map-state is-warning">
          Lô đang giới thiệu không còn trong dữ liệu bản đồ. Bạn vẫn có thể tiếp
          tục xem các phương án khác.
        </div>
      )}
    </div>
  )
}

export default memo(GuidedTourMap)
