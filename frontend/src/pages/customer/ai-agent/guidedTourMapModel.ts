import {
  getCemeteryCoordinates,
  getCemeteryZoneCode,
} from '@/lib/cemeteryMapLayout'
import { MAP_VIEWBOX } from '@/lib/cemeteryMapVisuals'
import type { GuidedTourStep } from './guidedTour'

export type PlotStatus =
  'available' | 'pending' | 'reserved' | 'sold' | 'locked'

export interface BackendMapPlot {
  id?: string | number
  plotCode?: string
  zoneCode?: string
  zoneName?: string
  rowCode?: string
  plotNumber?: number | string
  status?: string
  price?: number | string
  area?: number | string
  direction?: string
}

export interface GuidedTourPlot {
  id: number
  plotCode: string
  zoneName: string
  status: PlotStatus
  price: number
  area: number
  direction: string
  x: number
  y: number
  width: number
  height: number
}

export interface CameraState {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

const [overviewX, overviewY, overviewWidth, overviewHeight] =
  MAP_VIEWBOX.split(/\s+/).map(Number)

export const OVERVIEW_CAMERA: CameraState = {
  x: overviewX,
  y: overviewY,
  width: overviewWidth,
  height: overviewHeight,
  rotation: 0,
}

function normalizeStatus(value?: string): PlotStatus {
  if (value === 'pending') return 'pending'
  if (value === 'reserved') return 'reserved'
  if (value === 'locked') return 'locked'
  if (value === 'sold' || value === 'occupied' || value === 'my-lot') {
    return 'sold'
  }
  return 'available'
}

export function mapTourPlot(
  item: BackendMapPlot,
  index: number,
): GuidedTourPlot | null {
  const numericId = Number(item.id)
  if (!Number.isInteger(numericId) || numericId <= 0) return null
  const plotCode = item.plotCode || `P-${index + 1}`
  const zoneCode = getCemeteryZoneCode(plotCode, item.zoneCode, item.zoneName)
  const coordinates = getCemeteryCoordinates(item, plotCode, zoneCode)
  return {
    id: numericId,
    plotCode,
    zoneName: item.zoneName || `Khu ${zoneCode}`,
    status: normalizeStatus(item.status),
    price: Number(item.price || 0),
    area: Number(item.area || 0),
    direction: item.direction || 'Chưa xác định',
    ...coordinates,
  }
}

export function getCameraForPlots(
  plots: GuidedTourPlot[],
  step: GuidedTourStep,
): CameraState {
  if (
    step.cameraMode === 'overview' ||
    step.cameraMode === 'keep-current' ||
    !plots.length
  ) {
    return OVERVIEW_CAMERA
  }
  const minX = Math.min(...plots.map((plot) => plot.x))
  const minY = Math.min(...plots.map((plot) => plot.y))
  const maxX = Math.max(...plots.map((plot) => plot.x + plot.width))
  const maxY = Math.max(...plots.map((plot) => plot.y + plot.height))
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const contentWidth = maxX - minX
  const contentHeight = maxY - minY
  const width = Math.max(
    step.cameraMode === 'single-plot' ? 360 : 480,
    contentWidth + 240,
  )
  const height = Math.max(340, contentHeight + 220, width * 0.72)
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    rotation: 0,
  }
}
