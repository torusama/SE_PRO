// src/pages/customer/map/MapPage.tsx
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { API_BASE_URL, api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import './MapPage.css'

type PlotStatus = 'available' | 'pending' | 'reserved' | 'sold' | 'locked'
type StatusFilter = 'all' | PlotStatus
type SelectionMode = 'single' | 'cluster'

interface BackendMapPlot {
  id?: string | number
  plotCode?: string
  zoneName?: string
  rowCode?: string
  plotNumber?: number | string
  status?: string
  price?: number | string
  area?: number | string
  size?: string
  direction?: string
  description?: string
  currentViewers?: number
  currentSelectors?: number
}

interface MapPlot {
  id: string
  plotCode: string
  zoneCode: string
  zoneName: string
  rowCode: string
  plotNumber: number
  status: PlotStatus
  price: number
  area: number
  size: string
  direction: string
  description: string
  currentViewers: number
  currentSelectors: number
  x: number
  y: number
  width: number
  height: number
  isPlaceholder?: boolean
}

const T = {
  home: 'Trang ch\u1ee7',
  pageTitle: 'B\u1ea3n \u0111\u1ed3 ngh\u0129a trang 2D',
  searchTitle: 'T\u00ecm ki\u1ebfm l\u00f4',
  plotCode: 'M\u00e3 l\u00f4',
  searchPlaceholder: 'A-01-001 ho\u1eb7c t\u00ean khu',
  zones: 'Khu v\u1ef1c',
  allZones: 'T\u1ea5t c\u1ea3 khu',
  plots: 'l\u00f4',
  legend: 'Ch\u00fa gi\u1ea3i',
  empty: 'Kh\u00f4ng c\u00f3 l\u00f4 n\u00e0o kh\u1edbp v\u1edbi t\u00ecm ki\u1ebfm ho\u1eb7c b\u1ed9 l\u1ecdc hi\u1ec7n t\u1ea1i.',
  loading: '\u0110ang t\u1ea3i d\u1eef li\u1ec7u l\u00f4 t\u1eeb backend...',
  loadError: 'Kh\u00f4ng l\u1ea5y \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u t\u1eeb backend.',
  noData: 'Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u',
  plannedSlot: '\u00d4 \u0111\u1ea5t quy ho\u1ea1ch',
  realtimeStatus: 'Tr\u1ea1ng th\u00e1i th\u1eadt',
  single: 'M\u1ed9t l\u00f4',
  cluster: 'L\u00f4 gia t\u1ed9c',
  reset: '\u0110\u1eb7t l\u1ea1i',
  northRoad: 'Tr\u1ee5c \u0111\u01b0\u1eddng B\u1eafc',
  centralRoad: '\u0110\u01b0\u1eddng trung t\u00e2m',
  gate: 'C\u1ed5ng ch\u00ednh',
  funeralHome: 'Nh\u00e0 tang l\u1ec5',
  serviceArea: 'Khu d\u1ecbch v\u1ee5',
  notSelected: 'Ch\u01b0a ch\u1ecdn l\u00f4',
  selectHint: 'Ch\u1ecdn m\u1ed9t l\u00f4 tr\u00ean b\u1ea3n \u0111\u1ed3 \u0111\u1ec3 xem \u0111\u1ea7y \u0111\u1ee7 th\u00f4ng tin.',
  zone: 'Khu',
  row: 'H\u00e0ng',
  plotNumber: 'S\u1ed1 l\u00f4',
  status: 'Tr\u1ea1ng th\u00e1i',
  price: 'Gi\u00e1',
  area: 'Di\u1ec7n t\u00edch',
  size: 'K\u00edch th\u01b0\u1edbc',
  direction: 'H\u01b0\u1edbng',
  selectable: 'C\u00f3 th\u1ec3 ch\u1ecdn',
  yes: 'C\u00f3',
  no: 'Kh\u00f4ng',
  viewing: '\u0110ang xem',
  selecting: '\u0110ang ch\u1ecdn',
  people: 'ng\u01b0\u1eddi',
  description: 'M\u00f4 t\u1ea3',
  directionGuide: 'H\u01b0\u1edbng d\u1eabn \u0111\u01b0\u1eddng \u0111i',
  findRoute: 'T\u00ecm \u0111\u01b0\u1eddng',
  hideRoute: '\u1ea8n \u0111\u01b0\u1eddng \u0111i',
  continuePlot: 'G\u1eedi y\u00eau c\u1ea7u gi\u1eef ch\u1ed7',
  submitSelected: 'G\u1eedi y\u00eau c\u1ea7u cho c\u00e1c l\u00f4 \u0111\u00e3 ch\u1ecdn',
  submitting: '\u0110ang g\u1eedi y\u00eau c\u1ea7u...',
  submitted: '\u0110\u00e3 g\u1eedi y\u00eau c\u1ea7u ch\u1edd duy\u1ec7t.',
  loginRequired: 'B\u1ea1n c\u1ea7n \u0111\u0103ng nh\u1eadp \u0111\u1ec3 g\u1eedi y\u00eau c\u1ea7u gi\u1eef ch\u1ed7.',
  submitFailed: 'Kh\u00f4ng th\u1ec3 g\u1eedi y\u00eau c\u1ea7u gi\u1eef ch\u1ed7.',
  unavailable: 'L\u00f4 n\u00e0y hi\u1ec7n kh\u00f4ng th\u1ec3 ch\u1ecdn.',
  selectedPlots: 'L\u00f4 \u0111\u00e3 ch\u1ecdn',
  clusterHint: 'Ch\u1ecdn c\u00e1c l\u00f4 c\u00f2n tr\u1ed1ng \u0111\u1ec3 th\u00eam v\u00e0o nh\u00f3m gia \u0111\u00ecnh. C\u00e1c l\u00f4 c\u1ea7n n\u1eb1m li\u1ec1n k\u1ec1 nhau.',
  removeGroup: 'X\u00f3a kh\u1ecfi nh\u00f3m',
  totalPlots: 'T\u1ed5ng s\u1ed1 l\u00f4',
  totalPrice: 'T\u1ed5ng gi\u00e1 d\u1ef1 ki\u1ebfn',
  clear: 'X\u00f3a l\u1ef1a ch\u1ecdn',
  contact: 'Li\u00ean h\u1ec7 nh\u00e2n vi\u00ean',
}

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'T\u1ea5t c\u1ea3' },
  { value: 'available', label: 'C\u00f2n tr\u1ed1ng' },
  { value: 'pending', label: '\u0110ang ch\u1edd' },
  { value: 'reserved', label: '\u0110\u00e3 gi\u1eef ch\u1ed7' },
  { value: 'sold', label: '\u0110\u00e3 b\u00e1n' },
  { value: 'locked', label: '\u0110\u00e3 kh\u00f3a' },
]

const STATUS_LABEL: Record<PlotStatus, string> = {
  available: 'C\u00f2n tr\u1ed1ng',
  pending: '\u0110ang ch\u1edd',
  reserved: '\u0110\u00e3 gi\u1eef ch\u1ed7',
  sold: '\u0110\u00e3 b\u00e1n',
  locked: '\u0110\u00e3 kh\u00f3a',
}

const STATUS_COLOR: Record<PlotStatus, { fill: string; stroke: string; text: string }> = {
  available: { fill: 'rgba(0,184,158,0.26)', stroke: 'rgba(0,229,196,0.72)', text: '#bdfdf2' },
  pending: { fill: 'rgba(245,166,35,0.34)', stroke: 'rgba(245,166,35,0.86)', text: '#ffe2a7' },
  reserved: { fill: 'rgba(201,168,76,0.36)', stroke: 'rgba(240,192,96,0.9)', text: '#ffe2a7' },
  sold: { fill: 'rgba(171,62,62,0.46)', stroke: 'rgba(232,74,74,0.9)', text: '#ffd1d1' },
  locked: { fill: 'rgba(116,124,137,0.32)', stroke: 'rgba(154,164,180,0.68)', text: '#d5d9df' },
}

const ZONES = [
  { key: 'A', name: 'Khu A - Cao c\u1ea5p', dot: '#00b89e', labelX: 155, labelY: 33, mode: 'single' },
  { key: 'B', name: 'Khu B - Ti\u00eau chu\u1ea9n', dot: '#c9a84c', labelX: 400, labelY: 33, mode: 'single' },
  { key: 'D', name: 'Khu D - B\u00ecnh d\u00e2n', dot: '#4da6ff', labelX: 645, labelY: 33, mode: 'single' },
  { key: 'C', name: 'Khu C - L\u00f4 gia t\u1ed9c', dot: '#7b6bcc', labelX: 400, labelY: 33, mode: 'cluster' },
]

const ZONE_LAYOUT: Record<string, {
  name: string
  x: number
  width: number
  cols: number
  rows: number
  topRows: number
  midRows: number
  bottomRows: number
  gap: number
}> = {
  A: { name: ZONES[0].name, x: 60, width: 190, cols: 5, rows: 14, topRows: 4, midRows: 5, bottomRows: 5, gap: 6 },
  B: { name: ZONES[1].name, x: 305, width: 190, cols: 5, rows: 14, topRows: 4, midRows: 5, bottomRows: 5, gap: 6 },
  D: { name: ZONES[2].name, x: 550, width: 190, cols: 5, rows: 14, topRows: 4, midRows: 5, bottomRows: 5, gap: 6 },
  C: { name: ZONES[3].name, x: 60, width: 680, cols: 12, rows: 12, topRows: 4, midRows: 4, bottomRows: 4, gap: 8 },
}

const LAND_BANDS = {
  top: { y: 48, height: 110 },
  mid: { y: 204, height: 140 },
  bottom: { y: 414, height: 140 },
}

const TEXT_FIXES: Array<[RegExp, string]> = [
  [/Khu A .+ Cao C.+p/gi, ZONE_LAYOUT.A.name],
  [/Khu B .+ Ti.+u Chu.+n/gi, ZONE_LAYOUT.B.name],
  [/Khu C .+ Gia .+nh/gi, ZONE_LAYOUT.C.name],
  [/Khu D .+ B.+nh D.+n/gi, ZONE_LAYOUT.D.name],
  [/Ä.?Ã´ng|Ã„.?ÃƒÂ´ng/g, '\u0110\u00f4ng'],
  [/TÃ¢y|TÃƒÂ¢y/g, 'T\u00e2y'],
  [/Báº¯c|BÃ¡ÂºÂ¯c/g, 'B\u1eafc'],
]

function cleanText(value?: string) {
  let text = value || ''
  text = text
    .replace(/\?\?ng Nam/g, '\u0110\u00f4ng Nam')
    .replace(/\?\?ng/g, '\u0110\u00f4ng')
    .replace(/T\?y B\?c/g, 'T\u00e2y B\u1eafc')
    .replace(/T\?y/g, 'T\u00e2y')
    .replace(/B\?c/g, 'B\u1eafc')
  TEXT_FIXES.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement)
  })
  return text.replace(/â€”|â€“|Ã¢â‚¬â€|Ã¢â‚¬â€œ/g, '-').replace(/Â|Ã‚/g, '').trim()
}

function cleanDescriptionText(value?: string) {
  return (value || '')
    .replace(/\?\?ng Nam/g, '\u0110\u00f4ng Nam')
    .replace(/\?\?ng/g, '\u0110\u00f4ng')
    .replace(/T\?y B\?c/g, 'T\u00e2y B\u1eafc')
    .replace(/T\?y/g, 'T\u00e2y')
    .replace(/B\?c/g, 'B\u1eafc')
    .replace(/Ã¢â‚¬â€|Ã¢â‚¬â€œ|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“/g, '-')
    .replace(/Ã‚|Ãƒâ€š/g, '')
    .trim()
}

function normalizeStatus(status?: string): PlotStatus {
  if (status === 'occupied' || status === 'my-lot' || status === 'sold') return 'sold'
  if (status === 'pending') return 'pending'
  if (status === 'reserved') return 'reserved'
  if (status === 'locked') return 'locked'
  return 'available'
}

function getZoneCode(plotCode: string, zoneName?: string) {
  const fromCode = plotCode.match(/^[A-D]/i)?.[0]?.toUpperCase()
  if (fromCode && ZONE_LAYOUT[fromCode]) return fromCode
  const fromName = cleanText(zoneName).match(/Khu\s+([A-D])/i)?.[1]?.toUpperCase()
  return fromName && ZONE_LAYOUT[fromName] ? fromName : 'A'
}

function getCodeParts(plotCode: string) {
  const [, rowPart, plotPart] = plotCode.match(/^[A-D]-(\d{2})-(\d{3})$/i) || []
  return {
    row: Number(rowPart || 1),
    col: Number(plotPart || 1),
  }
}

function getCoordinates(item: BackendMapPlot, plotCode: string, zoneCode: string) {
  const layout = ZONE_LAYOUT[zoneCode] || ZONE_LAYOUT.A
  const parts = getCodeParts(plotCode)
  const row = Number(item.rowCode || parts.row || 1)
  const col = Number(item.plotNumber || parts.col || 1)
  if (zoneCode === 'C') {
    const familyBlocks = [ZONE_LAYOUT.A, ZONE_LAYOUT.B, ZONE_LAYOUT.D]
    const colsPerBlock = 4
    const block = familyBlocks[Math.floor((col - 1) / colsPerBlock)] || familyBlocks[0]
    const localCol = (col - 1) % colsPerBlock
    const colGap = layout.gap
    const width = (block.width - colGap * (colsPerBlock - 1)) / colsPerBlock
    const bandIndex = row <= layout.topRows
      ? 0
      : row <= layout.topRows + layout.midRows
        ? 1
        : 2
    const localRow = bandIndex === 0
      ? row - 1
      : bandIndex === 1
        ? row - layout.topRows - 1
        : row - layout.topRows - layout.midRows - 1
    const rowGap = layout.gap
    const height = 27
    const bandStartY = [40, 214, 418][bandIndex] ?? 418

    return {
      x: Number((block.x + localCol * (width + colGap)).toFixed(2)),
      y: Number((bandStartY + localRow * (height + rowGap)).toFixed(2)),
      width: Number(width.toFixed(2)),
      height: Number(height.toFixed(2)),
      rowCode: String(row).padStart(2, '0'),
      plotNumber: col,
    }
  }

  const band = row <= layout.topRows
    ? { ...LAND_BANDS.top, localRow: row - 1, rows: layout.topRows }
    : row <= layout.topRows + layout.midRows
      ? { ...LAND_BANDS.mid, localRow: row - layout.topRows - 1, rows: layout.midRows }
      : { ...LAND_BANDS.bottom, localRow: row - layout.topRows - layout.midRows - 1, rows: layout.bottomRows }
  const width = (layout.width - layout.gap * (layout.cols - 1)) / layout.cols
  const height = (band.height - layout.gap * (band.rows - 1)) / band.rows

  return {
    x: Number((layout.x + (col - 1) * (width + layout.gap)).toFixed(2)),
    y: Number((band.y + band.localRow * (height + layout.gap)).toFixed(2)),
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
    rowCode: String(row).padStart(2, '0'),
    plotNumber: col,
  }
}

function makePlaceholderPlot(zoneCode: string, row: number, col: number): MapPlot {
  const layout = ZONE_LAYOUT[zoneCode] || ZONE_LAYOUT.A
  const plotCode = `${zoneCode}-${String(row).padStart(2, '0')}-${String(col).padStart(3, '0')}`
  const coord = getCoordinates({ rowCode: String(row), plotNumber: col, area: zoneCode === 'C' ? 12 : 4 }, plotCode, zoneCode)
  const demo = getDemoPlotInfo(zoneCode, row, col)

  return {
    id: `planned-${plotCode}`,
    plotCode,
    zoneCode,
    zoneName: layout.name,
    rowCode: coord.rowCode,
    plotNumber: col,
    status: 'locked',
    price: demo.price,
    area: demo.area,
    size: demo.size,
    direction: demo.direction,
    description: demo.description,
    currentViewers: 0,
    currentSelectors: 0,
    x: coord.x,
    y: coord.y,
    width: coord.width,
    height: coord.height,
    isPlaceholder: true,
  }
}

function getDemoPlotInfo(zoneCode: string, row: number, col: number) {
  const direction = getPlannedDirection(zoneCode, row, col)
  const zonePrice: Record<string, number> = { A: 65000000, B: 45000000, C: 120000000, D: 32000000 }
  const area = zoneCode === 'C' ? 12 : zoneCode === 'A' ? 4.5 : zoneCode === 'B' ? 3.5 : 3
  const price = zonePrice[zoneCode] + row * (zoneCode === 'C' ? 1600000 : 950000) + col * (zoneCode === 'C' ? 520000 : 420000)
  const size = zoneCode === 'C' ? '3.0 x 4.0 m' : area >= 4 ? '2.0 x 2.0 m' : '1.5 x 2.0 m'
  const plotType = zoneCode === 'C' ? 'l\u00f4 gia t\u1ed9c' : zoneCode === 'A' ? 'l\u00f4 cao c\u1ea5p' : 'l\u00f4 ti\u00eau chu\u1ea9n'

  return {
    price,
    area,
    size,
    direction,
    description: buildPlotIntro(`${zoneCode}-${String(row).padStart(2, '0')}-${String(col).padStart(3, '0')}`, ZONE_LAYOUT[zoneCode]?.name || plotType, String(row).padStart(2, '0'), col, area, direction, price),
  }
}

function buildFullMapPlots(realPlots: MapPlot[]) {
  const byCode = new Map(realPlots.map((plot) => [plot.plotCode, plot]))
  const full: MapPlot[] = []

  Object.entries(ZONE_LAYOUT).forEach(([zoneCode, layout]) => {
    for (let row = 1; row <= layout.rows; row += 1) {
      for (let col = 1; col <= layout.cols; col += 1) {
        const planned = makePlaceholderPlot(zoneCode, row, col)
        const real = byCode.get(planned.plotCode)
        full.push(real ? { ...planned, ...real, x: planned.x, y: planned.y, width: planned.width, height: planned.height, isPlaceholder: false } : planned)
      }
    }
  })

  return full
}

const INITIAL_PLANNED_PLOTS = buildFullMapPlots([])

function mapBackendPlot(item: BackendMapPlot, index: number): MapPlot {
  const plotCode = item.plotCode || String(item.id || `P-${index + 1}`)
  const zoneCode = getZoneCode(plotCode, item.zoneName)
  const coord = getCoordinates(item, plotCode, zoneCode)
  const status = normalizeStatus(item.status)
  const zoneName = ZONE_LAYOUT[zoneCode]?.name || cleanText(item.zoneName)
  const area = Number(item.area || 4)
  const direction = cleanText(item.direction) || getPlannedDirection(zoneCode, coord.rowCode, coord.plotNumber)

  return {
    id: String(item.id ?? plotCode),
    plotCode,
    zoneCode,
    zoneName,
    rowCode: coord.rowCode,
    plotNumber: coord.plotNumber,
    status,
    price: Number(item.price || 0),
    area,
    size: item.size || (zoneCode === 'C' ? '3.0 x 4.0 m' : area >= 8 ? '4.0 x 2.0 m' : '2.0 x 2.0 m'),
    direction,
    description: cleanDescriptionText(item.description) || buildPlotIntro(plotCode, zoneName, coord.rowCode, coord.plotNumber, area, direction, Number(item.price || 0)),
    currentViewers: Number(item.currentViewers || 0),
    currentSelectors: Number(item.currentSelectors || 0),
    x: coord.x,
    y: coord.y,
    width: coord.width,
    height: coord.height,
  }
}

function formatVnd(value: number) {
  if (!value) return T.contact
  return `${new Intl.NumberFormat('vi-VN').format(value)} \u0111`
}

function getStatusLabel(plot: MapPlot) {
  return plot.isPlaceholder ? T.noData : STATUS_LABEL[plot.status]
}

function getPlannedDirection(zoneCode: string, rowInput: string | number, colInput: string | number) {
  const row = Number(rowInput || 1)
  const col = Number(colInput || 1)
  const coord = getCoordinates({ rowCode: String(row), plotNumber: col }, `${zoneCode}-${String(row).padStart(2, '0')}-${String(col).padStart(3, '0')}`, zoneCode)
  const centerX = coord.x + coord.width / 2
  const centerY = coord.y + coord.height / 2
  const roadCandidates = [
    { direction: centerX < 279 ? '\u0110\u00f4ng' : 'T\u00e2y', distance: Math.abs(centerX - 279) },
    { direction: centerX < 524 ? '\u0110\u00f4ng' : 'T\u00e2y', distance: Math.abs(centerX - 524) },
    { direction: centerY < 179 ? 'Nam' : 'B\u1eafc', distance: Math.abs(centerY - 179) },
    { direction: centerY < 389 ? 'Nam' : 'B\u1eafc', distance: Math.abs(centerY - 389) },
  ]
  return roadCandidates.sort((a, b) => a.distance - b.distance)[0].direction
}

function buildPlotIntro(plotCode: string, zoneName: string, rowCode: string, plotNumber: number, area: number, direction: string, price: number) {
  const priceText = price ? `Gi\u00e1 ni\u00eam y\u1ebft ${formatVnd(price)}.` : 'Gi\u00e1 s\u1ebd \u0111\u01b0\u1ee3c nh\u00e2n vi\u00ean x\u00e1c nh\u1eadn khi t\u01b0 v\u1ea5n.'
  const typeText = area >= 10 ? 'l\u00f4 gia t\u1ed9c' : 'l\u00f4 \u0111\u01a1n'
  const zoneCode = plotCode[0]?.toUpperCase() || 'A'
  const row = Number(rowCode || 1)
  const positionNote = getPlotPositionNote(zoneCode, row, plotNumber)
  const zoneNote = getZoneIntro(zoneCode)
  return `T\u1ed5ng quan: ${plotCode} l\u00e0 ${typeText} thu\u1ed9c ${zoneName}, di\u1ec7n t\u00edch ${area} m2, h\u01b0\u1edbng ${direction.toLowerCase()} theo la b\u00e0n. | \u0110i\u1ec3m n\u1ed5i b\u1eadt: ${positionNote} | G\u1ee3i \u00fd: ${zoneNote} | Gi\u00e1: ${priceText}`
}

function getPlotPositionNote(zoneCode: string, row: number, plotNumber: number) {
  const maxCol = zoneCode === 'C' ? 12 : 5
  const band = row <= 4
    ? 'n\u1eb1m \u1edf d\u1ea3i ph\u00eda B\u1eafc, g\u1ea7n tr\u1ee5c \u0111\u01b0\u1eddng B\u1eafc'
    : row <= 8
      ? 'n\u1eb1m \u1edf khu trung t\u00e2m, thu\u1eadn ti\u1ec7n di chuy\u1ec3n t\u1eeb c\u1ea3 hai tr\u1ee5c \u0111\u01b0\u1eddng'
      : 'n\u1eb1m \u1edf d\u1ea3i ph\u00eda Nam, g\u1ea7n l\u1ed1i v\u00e0o t\u1eeb c\u1ed5ng ch\u00ednh'
  const side = plotNumber <= Math.ceil(maxCol / 3)
    ? 's\u00e1t nh\u00e1nh l\u1ed1i b\u00ean tr\u00e1i c\u1ee7a khu'
    : plotNumber >= maxCol - Math.floor(maxCol / 3) + 1
      ? 's\u00e1t nh\u00e1nh l\u1ed1i b\u00ean ph\u1ea3i c\u1ee7a khu'
      : 'n\u1eb1m trong ph\u1ea7n l\u00f5i y\u00ean t\u0129nh c\u1ee7a khu'
  return `V\u1ecb tr\u00ed ${band}, ${side}, ph\u00f9 h\u1ee3p cho vi\u1ec7c th\u0103m vi\u1ebfng \u0111\u1ecbnh k\u1ef3.`
}

function getZoneIntro(zoneCode: string) {
  if (zoneCode === 'A') return 'Khu A c\u00f3 kh\u00f4ng gian trang tr\u1ecdng, m\u1eadt \u0111\u1ed9 tho\u00e1ng v\u00e0 ph\u00f9 h\u1ee3p v\u1edbi gia \u0111\u00ecnh mu\u1ed1n ch\u1ecdn v\u1ecb tr\u00ed cao c\u1ea5p.'
  if (zoneCode === 'B') return 'Khu B c\u00e2n b\u1eb1ng gi\u1eefa chi ph\u00ed v\u00e0 v\u1ecb tr\u00ed, ph\u00f9 h\u1ee3p nhu c\u1ea7u ch\u1ecdn l\u00f4 \u1ed5n \u0111\u1ecbnh, d\u1ec5 ti\u1ebfp c\u1eadn.'
  if (zoneCode === 'C') return 'Khu C d\u00e0nh cho l\u00f4 gia t\u1ed9c, di\u1ec7n t\u00edch r\u1ed9ng h\u01a1n, thu\u1eadn ti\u1ec7n quy t\u1ee5 nhi\u1ec1u th\u00e0nh vi\u00ean trong c\u00f9ng gia \u0111\u00ecnh.'
  return 'Khu D c\u00f3 m\u1ee9c gi\u00e1 d\u1ec5 ti\u1ebfp c\u1eadn, ph\u00f9 h\u1ee3p gia \u0111\u00ecnh mu\u1ed1n \u01b0u ti\u00ean chi ph\u00ed nh\u01b0ng v\u1eabn \u0111\u1ea3m b\u1ea3o l\u1ed1i \u0111i r\u00f5 r\u00e0ng.'
}

function descriptionLines(description: string) {
  const text = description.trim()
  if (!text) return []
  if (text.includes('|')) return text.split('|').map((line) => line.trim()).filter(Boolean)
  return text.split('. ').map((line, index, items) => {
    const trimmed = line.trim()
    return trimmed && index < items.length - 1 && !trimmed.endsWith('.') ? `${trimmed}.` : trimmed
  }).filter(Boolean)
}

function buildDirection(plot: MapPlot) {
  const route = getRouteMeta(plot)
  const turnText = route.roadX < plot.x + plot.width / 2 ? 'r\u1ebd ph\u1ea3i v\u00e0o khu l\u00f4' : 'r\u1ebd tr\u00e1i v\u00e0o khu l\u00f4'
  return `T\u1eeb c\u1ed5ng ch\u00ednh ph\u00eda Nam, \u0111i theo l\u1ed1i ven d\u01b0\u1edbi \u0111\u1ebfn tr\u1ee5c \u0111\u01b0\u1eddng g\u1ea7n ${plot.zoneName}. Sau \u0111\u00f3 ${turnText}, \u0111i d\u1ecdc theo h\u00e0ng ${plot.rowCode} v\u00e0 d\u1eebng \u1edf c\u1ea1nh l\u00f4 ${plot.plotCode}.`
}

function getRouteMeta(plot: MapPlot) {
  const layout = ZONE_LAYOUT[plot.zoneCode] || ZONE_LAYOUT.A
  const row = Number(plot.rowCode || 1)
  const col = Number(plot.plotNumber || 1)
  const colsPerBlock = plot.zoneCode === 'C' ? 4 : layout.cols
  const localCol = (col - 1) % colsPerBlock
  const topRows = layout.topRows
  const midRows = layout.midRows
  const bandIndex = row <= topRows ? 0 : row <= topRows + midRows ? 1 : 2
  const rowsInBand = bandIndex === 0 ? layout.topRows : bandIndex === 1 ? layout.midRows : layout.bottomRows
  const localRow = bandIndex === 0 ? row - 1 : bandIndex === 1 ? row - topRows - 1 : row - topRows - midRows - 1
  const gap = plot.zoneCode === 'C' ? layout.gap : layout.gap
  const centerX = plot.x + plot.width / 2
  const centerY = plot.y + plot.height / 2
  const roadX = centerX < 400 ? 279 : 524
  const approachFromRight = roadX > centerX
  const rowAisleY = localRow < rowsInBand - 1
    ? plot.y + plot.height + gap / 2
    : localRow > 0
      ? plot.y - gap / 2
      : centerY
  const externalGap = 12
  const colAisleX = approachFromRight
    ? localCol < colsPerBlock - 1
      ? plot.x + plot.width + gap / 2
      : plot.x + plot.width + externalGap
    : localCol > 0
      ? plot.x - gap / 2
      : plot.x - externalGap
  const attachX = approachFromRight ? plot.x + plot.width : plot.x

  return {
    roadX,
    rowAisleY: Number(rowAisleY.toFixed(2)),
    colAisleX: Number(colAisleX.toFixed(2)),
    attachX: Number(attachX.toFixed(2)),
    attachY: Number(centerY.toFixed(2)),
  }
}

function routePoints(plot: MapPlot) {
  const route = getRouteMeta(plot)
  return [
    [400, 570],
    [route.roadX, 570],
    [route.roadX, route.rowAisleY],
    [route.colAisleX, route.rowAisleY],
    [route.colAisleX, route.attachY],
    [route.attachX, route.attachY],
  ].map(([x, y]) => `${x},${y}`).join(' ')
}

function arePlotsAdjacent(a: MapPlot, b: MapPlot) {
  if (a.zoneCode !== b.zoneCode) return false
  const sameFamilyBlock = a.zoneCode !== 'C' || Math.floor((a.plotNumber - 1) / 4) === Math.floor((b.plotNumber - 1) / 4)
  const sameRow = sameFamilyBlock && a.rowCode === b.rowCode && Math.abs(a.plotNumber - b.plotNumber) === 1
  const sameCol = a.plotNumber === b.plotNumber && Math.abs(Number(a.rowCode) - Number(b.rowCode)) === 1
  return sameRow || sameCol
}

function isAdjacentToCluster(plot: MapPlot, cluster: MapPlot[]) {
  return cluster.length === 0 || cluster.some((p) => arePlotsAdjacent(p, plot))
}

export default function MapPage() {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const starsRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const [plots, setPlots] = useState<MapPlot[]>(INITIAL_PLANNED_PLOTS)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [zoom, setZoom] = useState(1)
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single')
  const [selectedPlot, setSelectedPlot] = useState<MapPlot | null>(INITIAL_PLANNED_PLOTS[0] || null)
  const [routePlotId, setRoutePlotId] = useState<string | null>(null)
  const [clusterPlots, setClusterPlots] = useState<MapPlot[]>([])
  const [adjacencyWarning, setAdjacencyWarning] = useState('')
  const [hoverPlot, setHoverPlot] = useState<MapPlot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    const el = starsRef.current
    if (!el) return
    el.innerHTML = ''
    for (let i = 0; i < 60; i += 1) {
      const d = document.createElement('div')
      d.className = 'star'
      const size = Math.random() * 1.8 + 0.4
      const teal = Math.random() < 0.1
      const gold = Math.random() < 0.08
      d.style.cssText = `width:${size}px;height:${size}px;left:${Math.random() * 100}%;top:${Math.random() * 65}%;--d:${2 + Math.random() * 5}s;--delay:${-Math.random() * 6}s;background:${teal ? '#00e5c4' : gold ? '#c9a84c' : '#fff'}`
      el.appendChild(d)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    setLoadError('')
    fetch(`${API_BASE_URL}/plots/map`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<BackendMapPlot[] | { data?: BackendMapPlot[] }>
      })
      .then((data) => {
        if (cancelled) return
        const raw = Array.isArray(data) ? data : data.data
        const mapped = (raw || []).map(mapBackendPlot)
        const fullMap = buildFullMapPlots(mapped)
        setPlots(fullMap)
        setSelectedPlot((current) => current || fullMap[0] || null)
      })
      .catch((error: Error) => {
        if (cancelled || error.name === 'AbortError') return
        setPlots(INITIAL_PLANNED_PLOTS)
        setSelectedPlot((current) => current || INITIAL_PLANNED_PLOTS[0] || null)
        setLoadError('')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const zones = useMemo(() => {
    return ZONES.filter((zone) => zone.mode === selectionMode).map((zone) => ({
      ...zone,
      count: plots.filter((plot) => plot.zoneCode === zone.key).length,
    }))
  }, [plots, selectionMode])

  const stats = useMemo(() => {
    return plots.reduce(
      (acc, plot) => {
        const matchesMode = selectionMode === 'cluster' ? plot.zoneCode === 'C' : plot.zoneCode !== 'C'
        if (!matchesMode) return acc
        acc.total += 1
        if (plot.isPlaceholder) {
          acc.noData += 1
          return acc
        }
        acc[plot.status] += 1
        return acc
      },
      { total: 0, available: 0, pending: 0, reserved: 0, sold: 0, locked: 0, noData: 0 } as Record<PlotStatus | 'noData' | 'total', number>,
    )
  }, [plots, selectionMode])

  const filteredPlots = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return plots.filter((plot) => {
      const matchesMode = selectionMode === 'cluster' ? plot.zoneCode === 'C' : plot.zoneCode !== 'C'
      const matchesSearch = !query || plot.plotCode.toLowerCase().includes(query) || plot.zoneName.toLowerCase().includes(query)
      const matchesStatus = statusFilter === 'all' || (!plot.isPlaceholder && plot.status === statusFilter)
      const matchesZone = zoneFilter === 'all' || plot.zoneCode === zoneFilter
      return matchesMode && matchesSearch && matchesStatus && matchesZone
    })
  }, [plots, searchText, statusFilter, zoneFilter, selectionMode])

  useEffect(() => {
    if (selectedPlot && !filteredPlots.some((plot) => plot.id === selectedPlot.id)) {
      setSelectedPlot(null)
      setRoutePlotId(null)
    }
    if (!selectedPlot && filteredPlots.length > 0) {
      setSelectedPlot(filteredPlots[0])
    }
    setClusterPlots((current) => current.filter((plot) => filteredPlots.some((fp) => fp.id === plot.id)))
  }, [filteredPlots, selectedPlot])

  const clusterTotalPrice = useMemo(() => clusterPlots.reduce((sum, p) => sum + p.price, 0), [clusterPlots])
  const selectedColor = selectedPlot ? STATUS_COLOR[selectedPlot.status] : null
  const selectedIsAvailable = selectedPlot?.status === 'available' && !selectedPlot.isPlaceholder
  const routePlot = selectedPlot && routePlotId === selectedPlot.id ? selectedPlot : null
  const clusterIds = new Set(clusterPlots.map((p) => p.id))

  function handleModeChange(mode: SelectionMode) {
    setSelectionMode(mode)
    setAdjacencyWarning('')
    setRoutePlotId(null)
    setZoneFilter('all')
    setSearchText('')
    setSelectedPlot(null)
    if (mode === 'single') setClusterPlots([])
  }

  function handlePlotClick(plot: MapPlot) {
    setAdjacencyWarning('')
    setRoutePlotId(null)
    setSubmitMessage('')
    setSubmitError('')
    setSelectedPlot(plot)

    if (selectionMode === 'single') return
    if (plot.isPlaceholder || plot.status !== 'available') return

    const alreadySelected = clusterPlots.some((p) => p.id === plot.id)
    if (alreadySelected) {
      setClusterPlots((prev) => prev.filter((p) => p.id !== plot.id))
      return
    }

    if (!isAdjacentToCluster(plot, clusterPlots)) {
      setAdjacencyWarning('Vui l\u00f2ng ch\u1ecdn c\u00e1c l\u00f4 li\u1ec1n k\u1ec1 nhau cho nh\u00f3m gia \u0111\u00ecnh.')
      return
    }

    setClusterPlots((prev) => [...prev, plot])
  }

  function removeFromCluster(plotId: string) {
    setClusterPlots((prev) => prev.filter((p) => p.id !== plotId))
  }

  function clearCluster() {
    setClusterPlots([])
    setAdjacencyWarning('')
  }

  function handleMouseEnter(event: MouseEvent<SVGGElement>, plot: MapPlot) {
    const tooltip = tooltipRef.current
    if (!tooltip) return
    tooltip.style.display = 'block'
    tooltip.style.left = event.clientX + 14 + 'px'
    tooltip.style.top = event.clientY - 40 + 'px'
    setHoverPlot(plot)
  }

  function handleMouseMove(event: MouseEvent<SVGGElement>) {
    const tooltip = tooltipRef.current
    if (!tooltip) return
    tooltip.style.left = event.clientX + 14 + 'px'
    tooltip.style.top = event.clientY - 40 + 'px'
  }

  function handleMouseLeave() {
    if (tooltipRef.current) tooltipRef.current.style.display = 'none'
  }

  async function submitReservation(targetPlots: MapPlot[]) {
    const realAvailablePlots = targetPlots.filter((plot) => !plot.isPlaceholder && plot.status === 'available')
    if (realAvailablePlots.length === 0) return
    if (!token) {
      setSubmitError(T.loginRequired)
      navigate(ROUTES.LOGIN)
      return
    }

    setSubmitting(true)
    setSubmitError('')
    setSubmitMessage('')
    try {
      const plotIds = realAvailablePlots.map((plot) => Number(plot.id))
      const createResponse = await api.post('/reservations', {
        type: 'reserve',
        plotIds,
        note: `Customer selected ${plotIds.length} plot(s) from 2D map demo`,
      })
      const created = createResponse.data.data
      await api.post(`/reservations/${created.id}/submit`)
      setSubmitMessage(`${T.submitted} #${created.id}`)
      setPlots((current) => current.map((plot) => (plotIds.includes(Number(plot.id)) ? { ...plot, status: 'pending' } : plot)))
      setClusterPlots([])
      if (selectedPlot && plotIds.includes(Number(selectedPlot.id))) {
        setSelectedPlot((current) => current ? { ...current, status: 'pending' } : current)
      }
    } catch (error: any) {
      setSubmitError(error?.response?.data?.message || T.submitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  function getPlotClassName(plot: MapPlot) {
    const parts = ['plot-cell']
    if (plot.isPlaceholder) parts.push('placeholder')
    if (selectedPlot?.id === plot.id) parts.push('selected')
    if (selectionMode === 'cluster' && clusterIds.has(plot.id)) parts.push('cluster-selected')
    return parts.join(' ')
  }

  function getPlotStroke(plot: MapPlot) {
    if (clusterIds.has(plot.id)) return '#00e5c4'
    if (selectedPlot?.id === plot.id) return '#f0c060'
    return STATUS_COLOR[plot.status].stroke
  }

  return (
    <div className="map-page">
      <div className="bg-canvas">
        <div className="glow-orb glow-orb-gold" />
        <div className="glow-orb glow-orb-teal" />
        <svg className="mountain-layer" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,320 L0,200 Q180,120 360,170 Q540,220 720,130 Q900,40 1080,90 Q1200,125 1440,60 L1440,320 Z" fill="rgba(201,168,76,0.04)" />
          <path d="M0,320 L0,250 Q240,200 480,230 Q720,260 960,200 Q1200,140 1440,170 L1440,320 Z" fill="rgba(0,229,196,0.05)" />
        </svg>
        <div className="stars" ref={starsRef} />
      </div>

      <div className="breadcrumb">
        <a href={ROUTES.HOME}>{T.home}</a>
        <span className="sep">/</span>
        <span className="current">{T.pageTitle}</span>
      </div>

      <div className="app-body">
        <aside className="sidebar-left">
          <div className="sidebar-section">
            <div className="sidebar-title">{T.searchTitle}</div>
            <label className="search-box">
              <span className="search-label">{T.plotCode}</span>
              <input type="text" value={searchText} placeholder={T.searchPlaceholder} onChange={(event) => setSearchText(event.target.value)} />
            </label>
            <div className="filter-chips">
              {STATUS_OPTIONS.map((option) => (
                <button key={option.value} type="button" className={`chip ${statusFilter === option.value ? 'on' : ''}`} onClick={() => setStatusFilter(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-title">{T.zones}</div>
            <div className="zone-list">
              <button type="button" className={`zone-item ${zoneFilter === 'all' ? 'active-zone' : ''}`} onClick={() => setZoneFilter('all')}>
                <span className="zone-dot zone-dot-all" />
                <span className="zone-name">{T.allZones}</span>
                <span className="zone-count">{plots.length} {T.plots}</span>
              </button>
              {zones.map((zone) => (
                <button key={zone.key} type="button" className={`zone-item ${zoneFilter === zone.key ? 'active-zone' : ''}`} onClick={() => setZoneFilter(zone.key)}>
                  <span className="zone-dot" style={{ background: zone.dot }} />
                  <span className="zone-name">{zone.name}</span>
                  <span className="zone-count">{zone.count} {T.plots}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-section compact-section">
            <div className="sidebar-title">{T.legend}</div>
            <div className="status-legend">
              {STATUS_OPTIONS.filter((option) => option.value !== 'all').map((option) => {
                const status = option.value as PlotStatus
                return (
                  <div className="status-row" key={status}>
                    <span className="status-dot" style={{ background: STATUS_COLOR[status].fill, borderColor: STATUS_COLOR[status].stroke }} />
                    {option.label}
                  </div>
                )
              })}
              <div className="status-row">
                <span className="status-dot" style={{ background: 'rgba(116, 124, 137, 0.08)', borderColor: 'rgba(122, 154, 144, 0.32)' }} />
                {T.noData}
              </div>
            </div>
          </div>

          {(isLoading || loadError || filteredPlots.length === 0) && (
            <div className="sidebar-empty">{isLoading ? T.loading : loadError || T.empty}</div>
          )}

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-num">{stats.total}</div><div className="stat-label">{T.plannedSlot}</div></div>
            <div className="stat-card"><div className="stat-num">{stats.available}</div><div className="stat-label">{STATUS_LABEL.available}</div></div>
            <div className="stat-card"><div className="stat-num amber">{stats.pending + stats.reserved}</div><div className="stat-label">{STATUS_LABEL.pending} / {STATUS_LABEL.reserved}</div></div>
            <div className="stat-card"><div className="stat-num red">{stats.sold}</div><div className="stat-label">{STATUS_LABEL.sold}</div></div>
            <div className="stat-card"><div className="stat-num gray">{stats.noData}</div><div className="stat-label">{T.noData}</div></div>
          </div>
        </aside>

        <main className="map-area">
          <div className="map-toolbar">
            <div className="mode-switch">
              <button type="button" className={`mode-btn ${selectionMode === 'single' ? 'active' : ''}`} onClick={() => handleModeChange('single')}>{T.single}</button>
              <button type="button" className={`mode-btn ${selectionMode === 'cluster' ? 'active' : ''}`} onClick={() => handleModeChange('cluster')}>{T.cluster}</button>
            </div>
          </div>

          <div className="map-canvas-wrap">
            <svg className="compass" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="North">
              <circle cx="20" cy="20" r="18" stroke="rgba(0,229,196,0.2)" strokeWidth="0.5" />
              <polygon points="20,4 23,18 20,20 17,18" fill="rgba(232,74,74,0.7)" />
              <polygon points="20,36 23,22 20,20 17,22" fill="rgba(0,229,196,0.4)" />
              <text x="20" y="8" textAnchor="middle" fill="rgba(232,74,74,0.8)" fontSize="6" fontFamily="Be Vietnam Pro">N</text>
            </svg>

            <svg id="cemetery-map" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,229,196,0.05)" strokeWidth="0.5" />
                </pattern>
              </defs>

              <rect width="800" height="600" fill="url(#grid)" />
              <rect x="30" y="30" width="740" height="540" rx="4" fill="none" stroke="rgba(0,229,196,0.15)" strokeWidth="1" />
              <rect x="30" y="170" width="740" height="18" className="map-road" />
              <rect x="30" y="380" width="740" height="18" className="map-road" />
              <rect x="270" y="30" width="18" height="540" className="map-road" />
              <rect x="515" y="30" width="18" height="540" className="map-road" />
              <text x="400" y="164" textAnchor="middle" className="map-road-label">{T.northRoad}</text>
              <text x="400" y="374" textAnchor="middle" className="map-road-label">{T.centralRoad}</text>
              <text x="400" y="588" textAnchor="middle" className="gate-label">{T.gate}</text>

              {zones.map((zone) => (
                <text key={zone.key} x={zone.labelX} y={zone.labelY} textAnchor="middle" className="zone-label">
                  {selectionMode === 'cluster' ? T.cluster.toUpperCase() : `KHU ${zone.key}`}
                </text>
              ))}

              {routePlot && <polyline className="route-line" points={routePoints(routePlot)} />}

              {filteredPlots.map((plot) => {
                const color = STATUS_COLOR[plot.status]
                return (
                  <g key={plot.id} className={getPlotClassName(plot)} onClick={() => handlePlotClick(plot)} onMouseEnter={(event) => handleMouseEnter(event, plot)} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
                    <rect className="lot-rect" x={plot.x} y={plot.y} width={plot.width} height={plot.height} rx="2" fill={color.fill} stroke={getPlotStroke(plot)} strokeWidth={selectedPlot?.id === plot.id || clusterIds.has(plot.id) ? 2 : 0.8} data-id={plot.id} data-zone={plot.zoneName} data-status={plot.status} />
                    <title>{plot.plotCode} - {plot.zoneName} - {getStatusLabel(plot)}</title>
                    <text x={plot.x + plot.width / 2} y={plot.y + Math.min(16, plot.height / 2 + 3)} textAnchor="middle" className="plot-code" fill={color.text}>{plot.plotNumber}</text>
                  </g>
                )
              })}

              {selectedPlot && filteredPlots.some((plot) => plot.id === selectedPlot.id) && (
                <rect x={selectedPlot.x + 1} y={selectedPlot.y + 1} width={selectedPlot.width - 2} height={selectedPlot.height - 2} rx="3" fill="none" stroke="#f0c060" strokeWidth="2" strokeDasharray="4,2" opacity="0.9" />
              )}
            </svg>

            {(isLoading || loadError || filteredPlots.length === 0) && (
              <div className="map-empty">{isLoading ? T.loading : loadError || T.empty}</div>
            )}

            <div className="map-zoom">
              <button className="zoom-btn" type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(z * 1.3, 4))}>+</button>
              <button className="zoom-btn" type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(z / 1.3, 0.5))}>-</button>
            </div>
          </div>
        </main>

        <aside className="panel-right">
          {!selectedPlot && (
            <div className="detail-empty">
              <div className="detail-empty-title">{T.notSelected}</div>
              <p>{T.selectHint}</p>
            </div>
          )}

          {selectedPlot && (
            <div className="detail-panel visible">
              <div className="detail-tag">{T.pageTitle}</div>
              <div className="detail-lot-id">{selectedPlot.plotCode}</div>
              <div className="detail-zone">{selectedPlot.zoneName} - {selectedPlot.rowCode} - {T.plotNumber} {selectedPlot.plotNumber}</div>
              <div className={`status-badge ${selectedPlot.status}`}>
                <span className="status-badge-dot" style={{ background: selectedColor?.stroke }} />
                {getStatusLabel(selectedPlot)}
              </div>

              {!selectedPlot.isPlaceholder && (
                <div className="detail-actions route-actions">
                  <button className="btn-secondary" type="button" onClick={() => setRoutePlotId((id) => (id === selectedPlot.id ? null : selectedPlot.id))}>
                    {routePlot ? T.hideRoute : T.findRoute}
                  </button>
                </div>
              )}

              <div className="detail-divider" />
              <div className="detail-row"><span className="detail-row-label">{T.plotCode}</span><span className="detail-row-val">{selectedPlot.plotCode}</span></div>
              <div className="detail-row"><span className="detail-row-label">{T.zone}</span><span className="detail-row-val">{selectedPlot.zoneName}</span></div>
              <div className="detail-row"><span className="detail-row-label">{T.row}</span><span className="detail-row-val">{selectedPlot.rowCode}</span></div>
              <div className="detail-row"><span className="detail-row-label">{T.status}</span><span className="detail-row-val highlight">{getStatusLabel(selectedPlot)}</span></div>
              <div className="detail-row"><span className="detail-row-label">{T.price}</span><span className="detail-row-val">{formatVnd(selectedPlot.price)}</span></div>
              <div className="detail-row"><span className="detail-row-label">{T.area}</span><span className="detail-row-val">{selectedPlot.area} m2</span></div>
              <div className="detail-row"><span className="detail-row-label">{T.size}</span><span className="detail-row-val">{selectedPlot.size}</span></div>
              <div className="detail-row"><span className="detail-row-label">{T.direction}</span><span className="detail-row-val">{selectedPlot.direction}</span></div>
              <div className="detail-row"><span className="detail-row-label">{T.selectable}</span><span className="detail-row-val">{selectedIsAvailable ? T.yes : T.no}</span></div>
              <div className="detail-row"><span className="detail-row-label">{T.viewing}</span><span className="detail-row-val">{selectedPlot.currentViewers} {T.people}</span></div>
              <div className="detail-row"><span className="detail-row-label">{T.selecting}</span><span className="detail-row-val">{selectedPlot.currentSelectors} {T.people}</span></div>

              <div className="description-box">
                <div className="box-label">{T.description}</div>
                <ul className="description-list">
                  {descriptionLines(selectedPlot.description).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>

              {submitError && <div className="selection-message">{submitError}</div>}
              {submitMessage && <div className="submit-success">{submitMessage}</div>}

              {routePlot && (
                <div className="direction-box">
                  <div className="box-label">{T.directionGuide}</div>
                  <p>{buildDirection(selectedPlot)}</p>
                </div>
              )}

              {selectionMode === 'single' && (
                <div className="detail-actions">
                  {selectedPlot.isPlaceholder ? (
                    <div className="selection-message">{selectedPlot.isPlaceholder ? T.noData : T.unavailable}</div>
                  ) : (
                    <>
                      {selectedIsAvailable ? (
                        <button className="btn-primary" type="button" disabled={submitting} onClick={() => submitReservation([selectedPlot])}>
                          {submitting ? T.submitting : T.continuePlot}
                        </button>
                      ) : (
                        <div className="selection-message">{T.unavailable}</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {selectionMode === 'cluster' && adjacencyWarning && <div className="adjacency-warning">{adjacencyWarning}</div>}
              {selectionMode === 'cluster' && !selectedIsAvailable && <div className="selection-message">{selectedPlot.isPlaceholder ? T.noData : T.unavailable}</div>}
            </div>
          )}

          {selectionMode === 'cluster' && (
            <div className="cluster-panel">
              <div className="cluster-title">{T.selectedPlots} ({clusterPlots.length})</div>
              {clusterPlots.length === 0 ? (
                <div className="cluster-empty">{T.clusterHint}</div>
              ) : (
                <>
                  <div className="cluster-list">
                    {clusterPlots.map((cp) => (
                      <div className="cluster-item" key={cp.id}>
                        <span className="cluster-item-code">{cp.plotCode}</span>
                        <span className="cluster-item-price">{formatVnd(cp.price)}</span>
                        <button type="button" className="cluster-remove-btn" title={T.removeGroup} onClick={() => removeFromCluster(cp.id)}>x</button>
                      </div>
                    ))}
                  </div>
                  <div className="cluster-summary">
                    <div className="cluster-summary-row"><span className="cluster-summary-label">{T.totalPlots}</span><span className="cluster-summary-val">{clusterPlots.length}</span></div>
                    <div className="cluster-summary-row"><span className="cluster-summary-label">{T.totalPrice}</span><span className="cluster-summary-val total">{formatVnd(clusterTotalPrice)}</span></div>
                  </div>
                  <div className="detail-actions" style={{ marginTop: 14 }}>
                    <button className="btn-primary" type="button" disabled={submitting} onClick={() => submitReservation(clusterPlots)}>
                      {submitting ? T.submitting : T.submitSelected}
                    </button>
                    <button className="btn-secondary" type="button" onClick={clearCluster}>{T.clear}</button>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>

      <div className="map-tooltip" ref={tooltipRef}>
        <div className="tooltip-id">{hoverPlot?.plotCode}</div>
        <div className="tooltip-status" style={{ color: hoverPlot ? STATUS_COLOR[hoverPlot.status].text : undefined }}>
          {hoverPlot ? `${hoverPlot.zoneName} - ${getStatusLabel(hoverPlot)}` : ''}
        </div>
        <div className="tooltip-price">{hoverPlot ? formatVnd(hoverPlot.price) : ''}</div>
      </div>
    </div>
  )
}
