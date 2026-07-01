// src/pages/customer/map/MapPage.tsx
// FR-02 · Bản đồ 2D tương tác — chọn khu đất / lô đất
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import './MapPage.css'

// ===== Kiểu dữ liệu cho 1 lô đất trên bản đồ =====
// (Nhẹ hơn LotCell trong types/lot.ts vì chỉ phục vụ hiển thị lưới bản đồ.
//  Khi nối API thật, có thể thay LOTS bên dưới bằng dữ liệu fetch từ server
//  và map sang LotCell khi mở chi tiết / đặt cọc.)
type MapLotStatus = 'available' | 'occupied' | 'reserved' | 'my-lot'

interface MapLot {
  id: string
  zone: string
  status: MapLotStatus
  x: number
  y: number
  price?: string
  owner?: string
}

interface ZoneInfo {
  name: string
  dot: string
  count: number
}

const ZONES: ZoneInfo[] = [
  { name: 'Khu Vĩnh Phúc', dot: '#00b89e', count: 180 },
  { name: 'Khu An Bình', dot: '#c9a84c', count: 240 },
  { name: 'Khu Phúc Lâm', dot: '#7b6bcc', count: 160 },
  { name: 'Khu Thiên Đức', dot: '#4da6ff', count: 120 },
  { name: 'Khu Vĩnh Hoa', dot: '#d85a7a', count: 200 },
]

// Toàn bộ lô đất — dữ liệu tách ra từ bản mock HTML gốc (FR-02), sau này thay bằng API
const LOTS: MapLot[] = [
  { id: "A-01", zone: "Vĩnh Phúc", status: "available", x: 44, y: 44, price: "85.000.000" },
  { id: "A-02", zone: "Vĩnh Phúc", status: "occupied", x: 76, y: 44, owner: "Nguyễn Văn An" },
  { id: "A-03", zone: "Vĩnh Phúc", status: "occupied", x: 108, y: 44 },
  { id: "A-04", zone: "Vĩnh Phúc", status: "available", x: 140, y: 44, price: "85.000.000" },
  { id: "A-05", zone: "Vĩnh Phúc", status: "reserved", x: 44, y: 68 },
  { id: "A-06", zone: "Vĩnh Phúc", status: "occupied", x: 76, y: 68 },
  { id: "A-07", zone: "Vĩnh Phúc", status: "available", x: 108, y: 68, price: "85.000.000" },
  { id: "A-08", zone: "Vĩnh Phúc", status: "occupied", x: 140, y: 68 },
  { id: "A-09", zone: "Vĩnh Phúc", status: "occupied", x: 44, y: 92 },
  { id: "A-10", zone: "Vĩnh Phúc", status: "available", x: 76, y: 92, price: "85.000.000" },
  { id: "A-12", zone: "Vĩnh Phúc", status: "my-lot", x: 108, y: 92, owner: "Nguyễn Văn Thanh" },
  { id: "A-11", zone: "Vĩnh Phúc", status: "occupied", x: 140, y: 92 },
  { id: "A-13", zone: "Vĩnh Phúc", status: "available", x: 44, y: 116, price: "85.000.000" },
  { id: "A-14", zone: "Vĩnh Phúc", status: "available", x: 76, y: 116, price: "85.000.000" },
  { id: "A-15", zone: "Vĩnh Phúc", status: "occupied", x: 108, y: 116 },
  { id: "A-16", zone: "Vĩnh Phúc", status: "reserved", x: 140, y: 116 },
  { id: "B-01", zone: "An Bình", status: "available", x: 202, y: 44, price: "95.000.000" },
  { id: "B-02", zone: "An Bình", status: "occupied", x: 234, y: 44 },
  { id: "B-03", zone: "An Bình", status: "occupied", x: 266, y: 44 },
  { id: "B-04", zone: "An Bình", status: "available", x: 298, y: 44, price: "95.000.000" },
  { id: "B-05", zone: "An Bình", status: "available", x: 330, y: 44, price: "95.000.000" },
  { id: "B-06", zone: "An Bình", status: "occupied", x: 362, y: 44 },
  { id: "B-07", zone: "An Bình", status: "occupied", x: 202, y: 68 },
  { id: "B-08", zone: "An Bình", status: "reserved", x: 234, y: 68 },
  { id: "B-09", zone: "An Bình", status: "available", x: 266, y: 68, price: "95.000.000" },
  { id: "B-10", zone: "An Bình", status: "occupied", x: 298, y: 68 },
  { id: "B-11", zone: "An Bình", status: "occupied", x: 330, y: 68 },
  { id: "B-12", zone: "An Bình", status: "available", x: 362, y: 68, price: "95.000.000" },
  { id: "B-05-2", zone: "An Bình", status: "my-lot", x: 202, y: 92, owner: "Trần Thị Lan" },
  { id: "B-13", zone: "An Bình", status: "occupied", x: 234, y: 92 },
  { id: "B-14", zone: "An Bình", status: "available", x: 266, y: 92, price: "95.000.000" },
  { id: "B-15", zone: "An Bình", status: "available", x: 298, y: 92, price: "95.000.000" },
  { id: "B-16", zone: "An Bình", status: "reserved", x: 330, y: 92 },
  { id: "B-17", zone: "An Bình", status: "occupied", x: 362, y: 92 },
  { id: "B-18", zone: "An Bình", status: "available", x: 202, y: 116, price: "95.000.000" },
  { id: "B-19", zone: "An Bình", status: "occupied", x: 234, y: 116 },
  { id: "B-20", zone: "An Bình", status: "available", x: 266, y: 116, price: "95.000.000" },
  { id: "B-21", zone: "An Bình", status: "occupied", x: 298, y: 116 },
  { id: "B-22", zone: "An Bình", status: "occupied", x: 330, y: 116 },
  { id: "B-23", zone: "An Bình", status: "available", x: 362, y: 116, price: "95.000.000" },
  { id: "C-01", zone: "Phúc Lâm", status: "occupied", x: 422, y: 44 },
  { id: "C-02", zone: "Phúc Lâm", status: "available", x: 454, y: 44, price: "110.000.000" },
  { id: "C-03", zone: "Phúc Lâm", status: "available", x: 486, y: 44, price: "110.000.000" },
  { id: "C-04", zone: "Phúc Lâm", status: "reserved", x: 518, y: 44 },
  { id: "C-05", zone: "Phúc Lâm", status: "occupied", x: 550, y: 44 },
  { id: "C-06", zone: "Phúc Lâm", status: "available", x: 582, y: 44, price: "110.000.000" },
  { id: "C-07", zone: "Phúc Lâm", status: "available", x: 422, y: 68, price: "110.000.000" },
  { id: "C-08", zone: "Phúc Lâm", status: "occupied", x: 454, y: 68 },
  { id: "C-09", zone: "Phúc Lâm", status: "occupied", x: 486, y: 68 },
  { id: "C-10", zone: "Phúc Lâm", status: "available", x: 518, y: 68, price: "110.000.000" },
  { id: "C-11", zone: "Phúc Lâm", status: "available", x: 550, y: 68, price: "110.000.000" },
  { id: "C-12", zone: "Phúc Lâm", status: "occupied", x: 582, y: 68 },
  { id: "D-01", zone: "Thiên Đức", status: "available", x: 632, y: 44, price: "130.000.000" },
  { id: "D-02", zone: "Thiên Đức", status: "occupied", x: 664, y: 44 },
  { id: "D-03", zone: "Thiên Đức", status: "available", x: 696, y: 44, price: "130.000.000" },
  { id: "D-04", zone: "Thiên Đức", status: "available", x: 728, y: 44, price: "130.000.000" },
  { id: "D-05", zone: "Thiên Đức", status: "occupied", x: 632, y: 68 },
  { id: "D-06", zone: "Thiên Đức", status: "reserved", x: 664, y: 68 },
  { id: "D-07", zone: "Thiên Đức", status: "available", x: 696, y: 68, price: "130.000.000" },
  { id: "D-08", zone: "Thiên Đức", status: "available", x: 728, y: 68, price: "130.000.000" },
  { id: "D-09", zone: "Thiên Đức", status: "available", x: 632, y: 92, price: "130.000.000" },
  { id: "D-10", zone: "Thiên Đức", status: "occupied", x: 664, y: 92 },
  { id: "D-11", zone: "Thiên Đức", status: "available", x: 696, y: 92, price: "130.000.000" },
  { id: "D-12", zone: "Thiên Đức", status: "occupied", x: 728, y: 92 },
  { id: "E-01", zone: "Vĩnh Hoa", status: "available", x: 202, y: 174, price: "78.000.000" },
  { id: "E-02", zone: "Vĩnh Hoa", status: "occupied", x: 234, y: 174 },
  { id: "E-03", zone: "Vĩnh Hoa", status: "available", x: 266, y: 174, price: "78.000.000" },
  { id: "E-04", zone: "Vĩnh Hoa", status: "available", x: 298, y: 174, price: "78.000.000" },
  { id: "E-05", zone: "Vĩnh Hoa", status: "reserved", x: 330, y: 174 },
  { id: "E-06", zone: "Vĩnh Hoa", status: "occupied", x: 362, y: 174 },
  { id: "E-07", zone: "Vĩnh Hoa", status: "occupied", x: 202, y: 198 },
  { id: "E-08", zone: "Vĩnh Hoa", status: "available", x: 234, y: 198, price: "78.000.000" },
  { id: "E-09", zone: "Vĩnh Hoa", status: "occupied", x: 266, y: 198 },
  { id: "E-10", zone: "Vĩnh Hoa", status: "available", x: 298, y: 198, price: "78.000.000" },
  { id: "E-11", zone: "Vĩnh Hoa", status: "available", x: 330, y: 198, price: "78.000.000" },
  { id: "E-12", zone: "Vĩnh Hoa", status: "occupied", x: 362, y: 198 },
  { id: "A-17", zone: "Vĩnh Phúc", status: "available", x: 44, y: 174, price: "85.000.000" },
  { id: "A-18", zone: "Vĩnh Phúc", status: "occupied", x: 76, y: 174 },
  { id: "A-19", zone: "Vĩnh Phúc", status: "available", x: 108, y: 174, price: "85.000.000" },
  { id: "A-20", zone: "Vĩnh Phúc", status: "reserved", x: 140, y: 174 },
  { id: "A-21", zone: "Vĩnh Phúc", status: "occupied", x: 44, y: 198 },
  { id: "A-22", zone: "Vĩnh Phúc", status: "available", x: 76, y: 198, price: "85.000.000" },
  { id: "A-23", zone: "Vĩnh Phúc", status: "available", x: 108, y: 198, price: "85.000.000" },
  { id: "A-24", zone: "Vĩnh Phúc", status: "occupied", x: 140, y: 198 },
  { id: "A-25", zone: "Vĩnh Phúc", status: "available", x: 44, y: 354, price: "85.000.000" },
  { id: "A-26", zone: "Vĩnh Phúc", status: "available", x: 76, y: 354, price: "85.000.000" },
  { id: "A-27", zone: "Vĩnh Phúc", status: "occupied", x: 108, y: 354 },
  { id: "A-28", zone: "Vĩnh Phúc", status: "occupied", x: 140, y: 354 },
  { id: "E-13", zone: "Vĩnh Hoa", status: "available", x: 202, y: 354, price: "78.000.000" },
  { id: "E-14", zone: "Vĩnh Hoa", status: "occupied", x: 234, y: 354 },
  { id: "E-15", zone: "Vĩnh Hoa", status: "available", x: 266, y: 354, price: "78.000.000" },
  { id: "E-16", zone: "Vĩnh Hoa", status: "available", x: 298, y: 354, price: "78.000.000" },
  { id: "E-17", zone: "Vĩnh Hoa", status: "reserved", x: 330, y: 354 },
  { id: "E-18", zone: "Vĩnh Hoa", status: "occupied", x: 362, y: 354 },
  { id: "C-13", zone: "Phúc Lâm", status: "available", x: 422, y: 354, price: "110.000.000" },
  { id: "C-14", zone: "Phúc Lâm", status: "occupied", x: 454, y: 354 },
  { id: "C-15", zone: "Phúc Lâm", status: "available", x: 486, y: 354, price: "110.000.000" },
  { id: "C-16", zone: "Phúc Lâm", status: "occupied", x: 518, y: 354 },
  { id: "D-13", zone: "Thiên Đức", status: "available", x: 632, y: 354, price: "130.000.000" },
  { id: "D-14", zone: "Thiên Đức", status: "available", x: 664, y: 354, price: "130.000.000" },
  { id: "D-15", zone: "Thiên Đức", status: "occupied", x: 696, y: 354 },
  { id: "D-16", zone: "Thiên Đức", status: "reserved", x: 728, y: 354 },
]

// Màu theo trạng thái. Với "available" thì màu phụ vào khu (zoneAvailableColor).
const ZONE_AVAILABLE_COLOR: Record<string, { fill: string; stroke: string }> = {
  'Vĩnh Phúc': { fill: 'rgba(0,184,158,0.18)', stroke: 'rgba(0,184,158,0.4)' },
  'An Bình': { fill: 'rgba(0,184,158,0.18)', stroke: 'rgba(0,184,158,0.4)' },
  'Phúc Lâm': { fill: 'rgba(0,184,158,0.18)', stroke: 'rgba(0,184,158,0.4)' },
  'Thiên Đức': { fill: 'rgba(77,166,255,0.2)', stroke: 'rgba(77,166,255,0.5)' },
  'Vĩnh Hoa': { fill: 'rgba(216,90,122,0.2)', stroke: 'rgba(216,90,122,0.5)' },
}
const STATUS_COLOR: Record<Exclude<MapLotStatus, 'available'>, { fill: string; stroke: string; sw: number }> = {
  occupied: { fill: 'rgba(201,168,76,0.55)', stroke: 'rgba(201,168,76,0.8)', sw: 0.5 },
  reserved: { fill: 'rgba(123,107,204,0.45)', stroke: 'rgba(123,107,204,0.7)', sw: 0.5 },
  'my-lot': { fill: 'rgba(240,192,96,0.8)', stroke: '#f0c060', sw: 1.5 },
}
function lotColor(lot: MapLot) {
  if (lot.status === 'available') return { ...ZONE_AVAILABLE_COLOR[lot.zone], sw: 0.5 }
  return STATUS_COLOR[lot.status]
}

const STATUS_LABEL: Record<MapLotStatus, string> = {
  available: 'Còn trống',
  occupied: 'Đã có chủ',
  reserved: 'Đang giữ chỗ',
  'my-lot': 'Lô của tôi',
}
const STATUS_BADGE_CLASS: Record<MapLotStatus, string> = {
  available: 'available',
  occupied: 'occupied',
  reserved: 'reserved',
  'my-lot': 'occupied',
}

export default function MapPage() {
  const navigate = useNavigate()
  const svgRef = useRef<SVGSVGElement>(null)
  const starsRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<SVGRectElement>(null)
  const selectedElRef = useRef<SVGRectElement | null>(null)

  const [activeChip, setActiveChip] = useState<string>('Tất cả')
  const [activeZone, setActiveZone] = useState<string>('Khu Vĩnh Phúc')
  const [zoom, setZoom] = useState(1)
  const [selectedLot, setSelectedLot] = useState<MapLot | null>(null)
  const [hoverLot, setHoverLot] = useState<MapLot | null>(null)

  // ===== Sao lấp lánh nền =====
  useEffect(() => {
    const el = starsRef.current
    if (!el) return
    el.innerHTML = ''
    for (let i = 0; i < 60; i++) {
      const d = document.createElement('div')
      d.className = 'star'
      const sz = Math.random() * 1.8 + 0.4
      const teal = Math.random() < 0.1
      const gold = Math.random() < 0.08
      d.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}%;top:${Math.random() * 65}%;--d:${2 + Math.random() * 5}s;--delay:${-Math.random() * 6}s;background:${teal ? '#00e5c4' : gold ? '#c9a84c' : '#fff'}`
      el.appendChild(d)
    }
  }, [])

  // ===== Chọn 1 lô đất trên bản đồ =====
  function selectLot(el: SVGRectElement, lot: MapLot) {
    if (selectedElRef.current) {
      selectedElRef.current.style.strokeWidth = ''
      selectedElRef.current.style.filter = ''
    }
    el.style.strokeWidth = '2'
    el.style.filter = 'brightness(1.4)'
    selectedElRef.current = el

    setSelectedLot(lot)

    // Khung viền vàng nhấp nháy quanh lô đang chọn
    const hl = highlightRef.current
    if (hl) {
      const bb = el.getBBox()
      hl.setAttribute('x', String(bb.x - 2))
      hl.setAttribute('y', String(bb.y - 2))
      hl.setAttribute('width', String(bb.width + 4))
      hl.setAttribute('height', String(bb.height + 4))
    }
  }

  // Tự động chọn lô "của tôi" (A-12) khi vào trang, giống bản demo gốc
  useEffect(() => {
    const t = setTimeout(() => {
      const myLot = LOTS.find((l) => l.id === 'A-12')
      const el = svgRef.current?.querySelector<SVGRectElement>('[data-id="A-12"]')
      if (myLot && el) selectLot(el, myLot)
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleMouseEnter(e: React.MouseEvent<SVGRectElement>, lot: MapLot) {
    const tt = tooltipRef.current
    if (!tt) return
    tt.style.display = 'block'
    tt.style.left = e.clientX + 14 + 'px'
    tt.style.top = e.clientY - 40 + 'px'
    setHoverLot(lot)
  }
  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    const tt = tooltipRef.current
    if (!tt) return
    tt.style.left = e.clientX + 14 + 'px'
    tt.style.top = e.clientY - 40 + 'px'
  }
  function handleMouseLeave() {
    if (tooltipRef.current) tooltipRef.current.style.display = 'none'
  }

  const isMyLot = selectedLot?.status === 'my-lot'
  const isOccupied = selectedLot?.status === 'occupied'

  function goToBooking() {
    if (!selectedLot) return
    navigate(ROUTES.BOOKING.replace(':lotId', selectedLot.id))
  }
  function goToDetail() {
    if (!selectedLot) return
    navigate(ROUTES.LOT_DETAIL.replace(':lotId', selectedLot.id))
  }

  return (
    <div className="map-page">
      {/* Nền */}
      <div className="bg-canvas">
        <div className="glow-orb" style={{ width: 600, height: 600, background: 'radial-gradient(circle,rgba(201,168,76,0.1),transparent 70%)', top: -100, right: -80 }} />
        <div className="glow-orb" style={{ width: 500, height: 500, background: 'radial-gradient(circle,rgba(0,229,196,0.07),transparent 70%)', bottom: 0, left: -80, animationDelay: '-5s' }} />
        <svg className="mountain-layer" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,320 L0,200 Q180,120 360,170 Q540,220 720,130 Q900,40 1080,90 Q1200,125 1440,60 L1440,320 Z" fill="rgba(201,168,76,0.04)" />
          <path d="M0,320 L0,250 Q240,200 480,230 Q720,260 960,200 Q1200,140 1440,170 L1440,320 Z" fill="rgba(0,229,196,0.05)" />
        </svg>
        <div className="lotus-float" style={{ top: '20%', left: '5%', animationDelay: '-3s' }}>🪷</div>
        <div className="lotus-float" style={{ top: '60%', right: '8%', fontSize: 40, animationDelay: '-7s' }}>🌕</div>
        <div className="stars" ref={starsRef} />
      </div>

      {/* Breadcrumb */}
      <div className="breadcrumb">
        <a href={ROUTES.HOME}>Trang chủ</a>
        <span className="sep">›</span>
        <span className="current">Bản đồ 2D tương tác</span>
      </div>

      <div className="app-body">
        {/* ===== SIDEBAR TRÁI ===== */}
        <div className="sidebar-left">
          <div className="sidebar-section" style={{ paddingBottom: 16 }}>
            <div className="sidebar-title">Tìm kiếm lô</div>
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Nhập mã lô, tên người..." />
            </div>
            <div className="filter-chips">
              {['Tất cả', 'Còn trống', 'Đã bán', 'Đặt cọc', 'Lô của tôi'].map((c) => (
                <div
                  key={c}
                  className={`chip ${activeChip === c ? (c === 'Lô của tôi' ? 'gold-on' : 'on') : ''}`}
                  onClick={() => setActiveChip(c)}
                >
                  {c}
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-section" style={{ paddingBottom: 12 }}>
            <div className="sidebar-title">Khu vực</div>
            <div className="zone-list">
              {ZONES.map((z) => (
                <div
                  key={z.name}
                  className={`zone-item ${activeZone === z.name ? 'active-zone' : ''}`}
                  onClick={() => setActiveZone(z.name)}
                >
                  <div className="zone-dot" style={{ background: z.dot }} />
                  <div className="zone-name">{z.name}</div>
                  <div className="zone-count">{z.count} lô</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '0 20px 12px' }}>
            <div className="sidebar-title">Trạng thái</div>
            <div className="status-legend">
              <div className="status-row"><div className="status-dot" style={{ background: 'rgba(0,229,196,0.5)' }} />Còn trống</div>
              <div className="status-row"><div className="status-dot" style={{ background: 'rgba(201,168,76,0.7)' }} />Đã có chủ</div>
              <div className="status-row"><div className="status-dot" style={{ background: 'rgba(123,107,204,0.7)' }} />Đặt cọc / Giữ chỗ</div>
              <div className="status-row"><div className="status-dot" style={{ background: 'rgba(232,74,74,0.5)' }} />Ngừng bán</div>
              <div className="status-row"><div className="status-dot" style={{ background: 'rgba(240,192,96,0.9)', outline: '1.5px solid #f0c060', outlineOffset: 1 }} />Lô của tôi</div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-num">342</div><div className="stat-label">Lô còn trống</div></div>
            <div className="stat-card"><div className="stat-num gold">558</div><div className="stat-label">Đã có chủ</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--purple)' }}>48</div><div className="stat-label">Đang giữ chỗ</div></div>
            <div className="stat-card"><div className="stat-num" style={{ color: 'var(--gold-bright)' }}>2</div><div className="stat-label">Lô của tôi</div></div>
          </div>
        </div>

        {/* ===== KHU VỰC BẢN ĐỒ ===== */}
        <div className="map-area">
          <div className="map-toolbar">
            <button className="map-btn active">↖ Chọn</button>
            <button className="map-btn">✋ Di chuyển</button>
            <button className="map-btn">📐 Đo</button>
            <button className="map-btn" style={{ marginLeft: 8 }} onClick={() => setZoom(1)}>⊙ Reset</button>
          </div>

          <svg className="compass" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="18" stroke="rgba(0,229,196,0.2)" strokeWidth="0.5" />
            <polygon points="20,4 23,18 20,20 17,18" fill="rgba(232,74,74,0.7)" />
            <polygon points="20,36 23,22 20,20 17,22" fill="rgba(0,229,196,0.4)" />
            <text x="20" y="3" textAnchor="middle" fill="rgba(232,74,74,0.8)" fontSize="6" fontFamily="Be Vietnam Pro">N</text>
          </svg>

          <svg
            id="cemetery-map"
            ref={svgRef}
            viewBox="0 0 800 600"
            xmlns="http://www.w3.org/2000/svg"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          >
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(0,229,196,0.05)" strokeWidth="0.5" />
              </pattern>
            </defs>

            <rect width="800" height="600" fill="url(#grid)" />
            <rect x="30" y="30" width="740" height="540" rx="4" fill="none" stroke="rgba(0,229,196,0.15)" strokeWidth="1" />

            {/* Đường nội bộ */}
            <rect x="30" y="150" width="740" height="18" className="map-road" />
            <rect x="30" y="330" width="740" height="18" className="map-road" />
            <rect x="180" y="30" width="18" height="540" className="map-road" />
            <rect x="400" y="30" width="18" height="540" className="map-road" />
            <rect x="610" y="30" width="18" height="540" className="map-road" />
            <text x="400" y="144" textAnchor="middle" className="map-road-label">Đường Chính Bắc - Nam</text>
            <text x="400" y="321" textAnchor="middle" className="map-road-label">Đường Trung Tâm</text>

            {/* Nhãn khu */}
            <text x="96" y="96" textAnchor="middle" className="zone-label">VĨNH PHÚC</text>
            <text x="295" y="96" textAnchor="middle" className="zone-label">AN BÌNH</text>
            <text x="500" y="96" textAnchor="middle" className="zone-label">PHÚC LÂM</text>
            <text x="706" y="96" textAnchor="middle" className="zone-label">THIÊN ĐỨC</text>
            <text x="295" y="280" textAnchor="middle" className="zone-label">VĨNH HOA</text>

            {/* Toàn bộ lô đất — sinh từ mảng LOTS */}
            {LOTS.map((lot) => {
              const c = lotColor(lot)
              return (
                <rect
                  key={lot.id}
                  className="lot-rect"
                  x={lot.x}
                  y={lot.y}
                  width="28"
                  height="20"
                  rx="2"
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={c.sw}
                  data-id={lot.id}
                  data-zone={lot.zone}
                  data-status={lot.status}
                  onClick={(e) => selectLot(e.currentTarget, lot)}
                  onMouseEnter={(e) => handleMouseEnter(e, lot)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />
              )
            })}

            {/* Khu dịch vụ / nhà tang lễ */}
            <text x="400" y="480" textAnchor="middle" fill="rgba(0,229,196,0.15)" fontSize="10" fontFamily="Be Vietnam Pro" letterSpacing="0.1em">NHÀ TANG LỄ</text>
            <rect x="350" y="490" width="100" height="50" rx="4" fill="rgba(0,229,196,0.04)" stroke="rgba(0,229,196,0.12)" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x="400" y="519" textAnchor="middle" fill="rgba(0,229,196,0.2)" fontSize="8" fontFamily="Be Vietnam Pro">⊞ Khu dịch vụ</text>

            {/* Khung nhấp nháy quanh lô đang chọn */}
            <rect ref={highlightRef} x="0" y="0" width="0" height="0" rx="3" fill="none" stroke="#f0c060" strokeWidth="2" strokeDasharray="4,2" opacity="0.8">
              <animate attributeName="stroke-dashoffset" from="0" to="12" dur="1s" repeatCount="indefinite" />
            </rect>
          </svg>

          <div className="map-zoom">
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.min(z * 1.3, 4))}>＋</button>
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.max(z / 1.3, 0.5))}>－</button>
          </div>

          <div className="map-minimap">
            <svg viewBox="0 0 800 600" width="120" height="80" style={{ opacity: 0.7 }}>
              <rect width="800" height="600" fill="rgba(4,6,14,0.5)" />
              <rect x="30" y="30" width="740" height="540" fill="none" stroke="rgba(0,229,196,0.3)" strokeWidth="2" />
              <rect x="180" y="30" width="18" height="540" fill="rgba(0,229,196,0.1)" />
              <rect x="400" y="30" width="18" height="540" fill="rgba(0,229,196,0.1)" />
              <rect x="610" y="30" width="18" height="540" fill="rgba(0,229,196,0.1)" />
              <rect x="30" y="150" width="740" height="18" fill="rgba(0,229,196,0.1)" />
              <rect x="30" y="330" width="740" height="18" fill="rgba(0,229,196,0.1)" />
              <rect x="30" y="30" width="200" height="150" fill="none" stroke="rgba(240,192,96,0.5)" strokeWidth="3" />
            </svg>
          </div>

          <div className="map-scale">
            <div className="scale-bar" />
            <span>50m</span>
          </div>
        </div>

        {/* ===== PANEL PHẢI ===== */}
        <div className="panel-right">
          {!selectedLot && (
            <div className="detail-empty">
              <div className="detail-empty-icon">🗺️</div>
              <p>Nhấp vào một lô trên bản đồ để xem thông tin chi tiết</p>
            </div>
          )}

          {selectedLot && (
            <>
              <div className="detail-panel visible">
                <div style={{ padding: '24px 24px 0' }}>
                  <div className="detail-tag">FR-02 · Chi tiết lô</div>
                  <div className="detail-lot-id">{selectedLot.id}</div>
                  <div className="detail-zone">
                    Khu {selectedLot.zone} · Hàng {selectedLot.id[0]}, Số {selectedLot.id.split('-')[1]}
                  </div>
                  <div className={`status-badge ${STATUS_BADGE_CLASS[selectedLot.status]}`}>
                    {selectedLot.status === 'my-lot' ? '★' : '●'} {STATUS_LABEL[selectedLot.status]}
                  </div>

                  <div className="detail-divider" />

                  <div className="detail-row"><span className="detail-row-label">Diện tích</span><span className="detail-row-val highlight">4,0 m²</span></div>
                  <div className="detail-row"><span className="detail-row-label">Kích thước</span><span className="detail-row-val">2,0 × 2,0 m</span></div>
                  <div className="detail-row"><span className="detail-row-label">Hướng</span><span className="detail-row-val">Đông Nam</span></div>
                  <div className="detail-row"><span className="detail-row-label">Loại phần mộ</span><span className="detail-row-val">Tiêu chuẩn</span></div>
                  <div className="detail-row"><span className="detail-row-label">Chủ sở hữu</span><span className="detail-row-val">{selectedLot.owner || '—'}</span></div>
                  <div className="detail-row"><span className="detail-row-label">Ngày cập nhật</span><span className="detail-row-val">15/06/2025</span></div>

                  {!isOccupied && !isMyLot && (
                    <div className="price-box">
                      <div className="price-label">Giá bán</div>
                      <div className="price-val">{selectedLot.price || '—'} ₫</div>
                      <div className="price-note">Đã bao gồm phí quản lý 5 năm đầu</div>
                    </div>
                  )}

                  {!isMyLot && !isOccupied && (
                    <div className="detail-actions">
                      <button className="btn-primary" onClick={goToBooking}>Đặt cọc / Mua lô →</button>
                      <button className="btn-secondary" onClick={goToDetail}>Xem chi tiết đầy đủ</button>
                      <button className="btn-ghost">🔗 Chia sẻ vị trí lô</button>
                    </div>
                  )}

                  {isMyLot && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button className="btn-primary" style={{ background: 'rgba(240,192,96,0.15)', borderColor: 'rgba(240,192,96,0.5)', color: 'var(--gold-bright)' }}>
                        Xem hợp đồng của tôi
                      </button>
                      <button className="btn-secondary">Đặt dịch vụ tưởng niệm</button>
                      <button className="btn-secondary">Yêu cầu chuyển nhượng</button>
                    </div>
                  )}
                </div>
                <div className="detail-divider" style={{ margin: '16px 24px' }} />
              </div>

              <div className="nearby-section">
                <div className="nearby-title">Lô lân cận</div>
                <div className="nearby-list">
                  <div className="nearby-item">
                    <div className="nearby-dot" style={{ background: 'rgba(0,229,196,0.5)' }} />
                    <div className="nearby-info"><strong>A-10</strong>Còn trống · 85.000.000 ₫</div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>↑ Phía trên</span>
                  </div>
                  <div className="nearby-item">
                    <div className="nearby-dot" style={{ background: 'rgba(0,229,196,0.5)' }} />
                    <div className="nearby-info"><strong>A-14</strong>Còn trống · 85.000.000 ₫</div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>↓ Phía dưới</span>
                  </div>
                  <div className="nearby-item">
                    <div className="nearby-dot" style={{ background: 'rgba(201,168,76,0.7)' }} />
                    <div className="nearby-info"><strong>A-11</strong>Đã có chủ</div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ Bên phải</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tooltip khi hover lô */}
      <div className="map-tooltip" ref={tooltipRef}>
        <div className="tooltip-id">{hoverLot?.id}</div>
        <div
          className="tooltip-status"
          style={{
            color:
              hoverLot?.status === 'available' ? 'var(--teal-glow)'
              : hoverLot?.status === 'occupied' ? 'var(--gold)'
              : hoverLot?.status === 'my-lot' ? 'var(--gold-bright)'
              : 'var(--purple)',
          }}
        >
          {hoverLot ? STATUS_LABEL[hoverLot.status] : ''}
        </div>
        <div className="tooltip-price">{hoverLot?.price ? hoverLot.price + ' ₫' : ''}</div>
      </div>
    </div>
  )
}