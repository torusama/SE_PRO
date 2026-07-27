import React from 'react'

export interface DirectionItem {
  direction: string
  star: string
  meaning: string
}

interface BaziCompassWidgetProps {
  cungMenh?: string
  tuMenh?: string
  element?: string
  napAmName?: string
  goodDirections?: DirectionItem[]
  badDirections?: DirectionItem[]
  preferredDirections?: string[]
}

const DIRECTIONS = [
  { key: 'Bắc', label: 'BẮC', angle: 0 },
  { key: 'Đông Bắc', label: 'Đ.BẮC', angle: 45 },
  { key: 'Đông', label: 'ĐÔNG', angle: 90 },
  { key: 'Đông Nam', label: 'Đ.NAM', angle: 135 },
  { key: 'Nam', label: 'NAM', angle: 180 },
  { key: 'Tây Nam', label: 'T.NAM', angle: 225 },
  { key: 'Tây', label: 'TÂY', angle: 270 },
  { key: 'Tây Bắc', label: 'T.BẮC', angle: 315 },
]

export const BaziCompassWidget: React.FC<BaziCompassWidgetProps> = ({
  cungMenh,
  tuMenh,
  element,
  napAmName,
  goodDirections = [],
  badDirections = [],
}) => {
  const getDirType = (dirKey: string) => {
    const isGood = goodDirections.some(
      (g) => g.direction.toLowerCase() === dirKey.toLowerCase(),
    )
    if (isGood) return 'good'
    const isBad = badDirections.some(
      (b) => b.direction.toLowerCase() === dirKey.toLowerCase(),
    )
    if (isBad) return 'bad'
    return 'neutral'
  }

  const getStarLabel = (dirKey: string) => {
    const goodItem = goodDirections.find(
      (g) => g.direction.toLowerCase() === dirKey.toLowerCase(),
    )
    if (goodItem) return goodItem.star
    const badItem = badDirections.find(
      (b) => b.direction.toLowerCase() === dirKey.toLowerCase(),
    )
    if (badItem) return badItem.star
    return ''
  }

  return (
    <div className="bazi-compass-container">
      <div className="bazi-compass-title">
        <span>☸ BÁT QUÁI LA BÀN PHONG THỦY</span>
      </div>

      <div className="bazi-compass-wrapper">
        <div className="bazi-compass-dial">
          {/* Compass Gold Outer Ring & Center */}
          <div className="bazi-compass-ring">
            <div className="bazi-compass-center">
              <div className="bazi-compass-center-title">
                {cungMenh ? `Cung ${cungMenh}` : 'BÁT TRẠCH'}
              </div>
              <div className="bazi-compass-center-sub">
                {tuMenh || 'Âm Trạch'}
              </div>
              {element && (
                <div className="bazi-compass-center-element">
                  Mệnh {element}
                </div>
              )}
            </div>
          </div>

          {/* 8 Directions Points around dial without overlapping arrow */}
          {DIRECTIONS.map((dir) => {
            const dirType = getDirType(dir.key)
            const star = getStarLabel(dir.key)
            const radius = 108 // px offset from center
            const rad = ((dir.angle - 90) * Math.PI) / 180
            const x = radius * Math.cos(rad)
            const y = radius * Math.sin(rad)

            return (
              <div
                key={dir.key}
                className={`bazi-compass-node node-${dirType}`}
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                }}
              >
                <div className="bazi-compass-node-dir">{dir.label}</div>
                {star && <div className="bazi-compass-node-star">{star}</div>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bazi-compass-legend">
        <div className="legend-item good">
          <span className="legend-dot good" />
          <span>Hướng Cát (Ưu tiên chọn)</span>
        </div>
        <div className="legend-item bad">
          <span className="legend-dot bad" />
          <span>Hướng Kỵ (Nên tránh)</span>
        </div>
      </div>
    </div>
  )
}

export default BaziCompassWidget
