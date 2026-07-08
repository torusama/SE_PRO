// src/pages/admin/map-management/MapManagementPage.tsx
import { useMemo, useState } from 'react'
import type { LotCell, LotStatus } from '@/types/lots'

const STATUS_META: Record<LotStatus, { label: string; fill: string; stroke: string }> = {
  available: { label: 'Còn trống', fill: '#0f3d33', stroke: '#00C8A0' },
  sold:      { label: 'Đã có chủ', fill: '#3d3416', stroke: '#F5A623' },
  reserved:  { label: 'Đặt cọc / Giữ chỗ', fill: '#2a2760', stroke: '#818cf8' },
  locked:    { label: 'Ngừng bán', fill: '#3d1f1f', stroke: '#FF5C5C' },
}

const ZONES = ['Khu Vĩnh Phúc', 'Khu A', 'Khu B', 'Khu C', 'Khu D']

// 10 cols x 5 rows mock grid for zone "Khu Vĩnh Phúc"
function buildMockLots(): LotCell[] {
  const rows = 5
  const cols = 10
  const rowLetters = ['A', 'B', 'C', 'D', 'E']
  const statuses: LotStatus[] = ['available', 'sold', 'reserved', 'locked']
  const weights = [0.48, 0.4, 0.08, 0.04]
  const lots: LotCell[] = []
  let seed = 7
  function rand() {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const roll = rand()
      let acc = 0
      let status: LotStatus = 'available'
      for (let i = 0; i < statuses.length; i++) {
        acc += weights[i]
        if (roll <= acc) { status = statuses[i]; break }
      }
      lots.push({
        id: `${rowLetters[r]}-${String(c + 1).padStart(2, '0')}`,
        zone: 'Khu Vĩnh Phúc',
        status,
        price: 23000000 + Math.floor(rand() * 8) * 1000000,
        area: 5 + Math.round(rand() * 30) / 10,
        floor: 1,
        row: r,
        direction: ['Đông', 'Tây', 'Nam', 'Bắc', 'Đông Nam'][Math.floor(rand() * 5)],
        type: 'Tiêu chuẩn',
      })
    }
  }
  return lots
}

const MOCK_LOTS = buildMockLots()

const panelStyle: React.CSSProperties = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg-secondary)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
  borderRadius: 7,
  padding: '7px 10px',
  fontSize: 12,
}

export default function MapManagementPage() {
  const [search, setSearch] = useState('')
  const [zone, setZone] = useState(ZONES[0])
  const [view, setView] = useState<'2d' | 'list'>('2d')
  const [selected, setSelected] = useState<LotCell | null>(null)

  const counts = useMemo(() => {
    const c: Record<LotStatus, number> = { available: 0, sold: 0, reserved: 0, locked: 0 }
    MOCK_LOTS.forEach((lot) => { c[lot.status] += 1 })
    return c
  }, [])

  const filteredLots = useMemo(
    () => MOCK_LOTS.filter((lot) => lot.id.toLowerCase().includes(search.trim().toLowerCase())),
    [search],
  )

  const rows = 5
  const cols = 10
  const cellW = 68
  const cellH = 56
  const gap = 6

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24, color: 'var(--color-text-primary)' }}>Bản đồ 2D Tương tác</h1>
        <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
          FR-02 / FR-10 · Quản lý vị trí lô đất
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#00C8A0' }}>{counts.available}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Còn trống</div>
        </div>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F5A623' }}>{counts.sold}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Đã có chủ</div>
        </div>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#818cf8' }}>{counts.reserved}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Đặt cọc</div>
        </div>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#FF5C5C' }}>{counts.locked}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Ngừng bán</div>
        </div>
      </div>

      <div style={panelStyle}>
        <div style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Tìm mã lô..."
            style={{ ...inputStyle, maxWidth: 200 }}
          />
          <select value={zone} onChange={(e) => setZone(e.target.value)} style={inputStyle}>
            {ZONES.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              onClick={() => setView('2d')}
              style={{ ...inputStyle, cursor: 'pointer', background: view === '2d' ? 'rgba(0,200,160,0.14)' : inputStyle.background, color: view === '2d' ? 'var(--color-accent-teal)' : 'var(--color-text-secondary)' }}>
              2D
            </button>
            <button
              onClick={() => setView('list')}
              style={{ ...inputStyle, cursor: 'pointer', background: view === 'list' ? 'rgba(0,200,160,0.14)' : inputStyle.background, color: view === 'list' ? 'var(--color-accent-teal)' : 'var(--color-text-secondary)' }}>
              Danh sách
            </button>
          </div>
          <button
            style={{ background: 'var(--color-accent-teal)', color: '#0A1628', fontWeight: 600, border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
            + Thêm lô
          </button>
        </div>

        {view === '2d' ? (
          <div style={{ padding: 20, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <svg width={cols * (cellW + gap)} height={rows * (cellH + gap) + 20} style={{ flexShrink: 0 }}>
              <text x={(cols * (cellW + gap)) / 2} y="14" textAnchor="middle" fontSize="12" fill="var(--color-text-muted)">
                {zone} — dãy A đến E
              </text>
              {MOCK_LOTS.map((lot) => {
                const col = MOCK_LOTS.indexOf(lot) % cols
                const row = lot.row
                const meta = STATUS_META[lot.status]
                const isMatch = filteredLots.includes(lot)
                return (
                  <g
                    key={lot.id}
                    transform={`translate(${col * (cellW + gap)}, ${row * (cellH + gap) + 24})`}
                    onClick={() => setSelected(lot)}
                    style={{ cursor: 'pointer', opacity: search && !isMatch ? 0.25 : 1 }}>
                    <rect
                      width={cellW}
                      height={cellH}
                      rx={6}
                      fill={selected?.id === lot.id ? meta.stroke : meta.fill}
                      stroke={meta.stroke}
                      strokeWidth={selected?.id === lot.id ? 2 : 1}
                    />
                    <text x={cellW / 2} y={cellH / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={selected?.id === lot.id ? '#0A1628' : 'var(--color-text-primary)'}>
                      {lot.id}
                    </text>
                  </g>
                )
              })}
            </svg>

            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                Chi tiết lô
              </div>
              {selected ? (
                <div style={{ display: 'grid', gap: 8, fontSize: 12.5 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent-teal)' }}>{selected.id}</div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>Khu vực: <span style={{ color: 'var(--color-text-primary)' }}>{selected.zone}</span></div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>Diện tích: <span style={{ color: 'var(--color-text-primary)' }}>{selected.area} m²</span></div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>Hướng: <span style={{ color: 'var(--color-text-primary)' }}>{selected.direction}</span></div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>Giá: <span style={{ color: 'var(--color-text-primary)' }}>{selected.price.toLocaleString('vi-VN')} đ</span></div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>Trạng thái: <span style={{ color: STATUS_META[selected.status].stroke }}>{STATUS_META[selected.status].label}</span></div>
                  <button
                    style={{ marginTop: 6, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}>
                    ✏ Sửa lô này
                  </button>
                </div>
              ) : (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: 12.5 }}>Nhấp vào một ô trên bản đồ để xem chi tiết.</div>
              )}

              <div style={{ marginTop: 20, display: 'grid', gap: 6 }}>
                {(Object.keys(STATUS_META) as LotStatus[]).map((status) => (
                  <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_META[status].fill, border: `1px solid ${STATUS_META[status].stroke}`, display: 'inline-block' }} />
                    {STATUS_META[status].label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Mã lô', 'Khu vực', 'Diện tích', 'Hướng', 'Giá', 'Trạng thái'].map((h) => (
                  <th key={h} style={{ padding: '10px 20px', fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLots.slice(0, 20).map((lot) => (
                <tr key={lot.id} onClick={() => setSelected(lot)} style={{ cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 20px', color: 'var(--color-accent-teal)', fontWeight: 600 }}>{lot.id}</td>
                  <td style={{ padding: '10px 20px', color: 'var(--color-text-secondary)' }}>{lot.zone}</td>
                  <td style={{ padding: '10px 20px', color: 'var(--color-text-secondary)' }}>{lot.area} m²</td>
                  <td style={{ padding: '10px 20px', color: 'var(--color-text-secondary)' }}>{lot.direction}</td>
                  <td style={{ padding: '10px 20px', color: 'var(--color-text-secondary)' }}>{lot.price.toLocaleString('vi-VN')} đ</td>
                  <td style={{ padding: '10px 20px', color: STATUS_META[lot.status].stroke }}>{STATUS_META[lot.status].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
