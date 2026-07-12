export interface MapCoordinateInput {
  rowCode?: string
  plotNumber?: number | string
}

export const CEMETERY_ZONES = [
  { key: 'A', name: 'Khu A - Cao cấp', dot: '#00b89e', labelX: 155, labelY: 33, mode: 'single' },
  { key: 'B', name: 'Khu B - Tiêu chuẩn', dot: '#c9a84c', labelX: 400, labelY: 33, mode: 'single' },
  { key: 'D', name: 'Khu D - Bình dân', dot: '#4da6ff', labelX: 645, labelY: 33, mode: 'single' },
  { key: 'C', name: 'Khu C - Lô gia tộc', dot: '#7b6bcc', labelX: 400, labelY: 33, mode: 'cluster' },
] as const

export const CEMETERY_ZONE_LAYOUT: Record<string, {
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
  A: { name: CEMETERY_ZONES[0].name, x: 60, width: 190, cols: 5, rows: 14, topRows: 4, midRows: 5, bottomRows: 5, gap: 6 },
  B: { name: CEMETERY_ZONES[1].name, x: 305, width: 190, cols: 5, rows: 14, topRows: 4, midRows: 5, bottomRows: 5, gap: 6 },
  D: { name: CEMETERY_ZONES[2].name, x: 550, width: 190, cols: 5, rows: 14, topRows: 4, midRows: 5, bottomRows: 5, gap: 6 },
  C: { name: CEMETERY_ZONES[3].name, x: 60, width: 680, cols: 12, rows: 12, topRows: 4, midRows: 4, bottomRows: 4, gap: 8 },
}

const LAND_BANDS = {
  top: { y: 48, height: 110 },
  mid: { y: 204, height: 140 },
  bottom: { y: 414, height: 140 },
}

export function getCemeteryZoneCode(plotCode: string, zoneCode?: string, zoneName?: string) {
  const explicit = zoneCode?.toUpperCase()
  if (explicit && CEMETERY_ZONE_LAYOUT[explicit]) return explicit
  const fromCode = plotCode.match(/^[A-D]/i)?.[0]?.toUpperCase()
  if (fromCode && CEMETERY_ZONE_LAYOUT[fromCode]) return fromCode
  const fromName = zoneName?.match(/Khu\s+([A-D])/i)?.[1]?.toUpperCase()
  return fromName && CEMETERY_ZONE_LAYOUT[fromName] ? fromName : 'A'
}

export function getCemeteryCoordinates(item: MapCoordinateInput, plotCode: string, zoneCode: string) {
  const layout = CEMETERY_ZONE_LAYOUT[zoneCode] || CEMETERY_ZONE_LAYOUT.A
  const [, rowPart, plotPart] = plotCode.match(/^[A-D]-(\d{2})-(\d{3})$/i) || []
  const row = Number(item.rowCode || rowPart || 1)
  const col = Number(item.plotNumber || plotPart || 1)

  if (zoneCode === 'C') {
    const familyBlocks = [CEMETERY_ZONE_LAYOUT.A, CEMETERY_ZONE_LAYOUT.B, CEMETERY_ZONE_LAYOUT.D]
    const colsPerBlock = 4
    const block = familyBlocks[Math.floor((col - 1) / colsPerBlock)] || familyBlocks[0]
    const localCol = (col - 1) % colsPerBlock
    const width = (block.width - layout.gap * (colsPerBlock - 1)) / colsPerBlock
    const bandIndex = row <= layout.topRows ? 0 : row <= layout.topRows + layout.midRows ? 1 : 2
    const localRow = bandIndex === 0 ? row - 1 : bandIndex === 1 ? row - layout.topRows - 1 : row - layout.topRows - layout.midRows - 1
    const height = 27
    const bandStartY = [40, 214, 418][bandIndex] ?? 418
    return {
      x: Number((block.x + localCol * (width + layout.gap)).toFixed(2)),
      y: Number((bandStartY + localRow * (height + layout.gap)).toFixed(2)),
      width: Number(width.toFixed(2)),
      height,
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

