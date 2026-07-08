// src/pages/admin/lot-management/LotManagementPage.tsx
import { useMemo, useState } from 'react'
import type { LotStatus } from '@/types/lots'

interface LotRow {
  id: string
  zone: string
  size: string
  direction: string
  price: number
  status: LotStatus
  owner: string
}

const MOCK_ROWS: LotRow[] = [
  { id: 'A-12', zone: 'Khu Vĩnh Phúc', size: '6.5 m²', direction: 'Đông Nam', price: 28500000, status: 'sold', owner: 'Nguyễn Văn Thành' },
  { id: 'A-13', zone: 'Khu Vĩnh Phúc', size: '6.5 m²', direction: 'Đông Nam', price: 28500000, status: 'available', owner: '—' },
  { id: 'A-14', zone: 'Khu Vĩnh Phúc', size: '7.2 m²', direction: 'Nam', price: 30000000, status: 'available', owner: '—' },
  { id: 'B-05', zone: 'Khu Vĩnh Phúc', size: '5.8 m²', direction: 'Tây', price: 25000000, status: 'sold', owner: 'Lê Thị Hương' },
  { id: 'B-22', zone: 'Khu Vĩnh Phúc', size: '5.0 m²', direction: 'Bắc', price: 23000000, status: 'sold', owner: 'Võ Thanh Hải' },
  { id: 'C-18', zone: 'Khu Vĩnh Phúc', size: '8.1 m²', direction: 'Nam', price: 6000000, status: 'locked', owner: 'Phạm Văn Tuấn' },
  { id: 'D-07', zone: 'Khu Vĩnh Phúc', size: '6.0 m²', direction: 'Đông', price: 26000000, status: 'reserved', owner: 'Trần Văn Long' },
  { id: 'A-31', zone: 'Khu Vĩnh Phúc', size: '7.5 m²', direction: 'Đông Nam', price: 28500000, status: 'sold', owner: 'Nguyễn Bích Chi' },
]

const STATUS_META: Record<LotStatus, { label: string; color: string; bg: string }> = {
  available: { label: 'Còn trống', color: '#00C8A0', bg: 'rgba(0,200,160,0.14)' },
  sold:      { label: 'Đã có chủ', color: '#F5A623', bg: 'rgba(245,166,35,0.16)' },
  reserved:  { label: 'Đặt cọc',   color: '#818cf8', bg: 'rgba(129,140,248,0.16)' },
  locked:    { label: 'Ngừng bán', color: '#FF5C5C', bg: 'rgba(255,92,92,0.14)' },
}

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

const PAGE_SIZE = 8
const TOTAL_LOTS = 1240

export default function LotManagementPage() {
  const [search, setSearch] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | LotStatus>('all')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<LotRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    return MOCK_ROWS.filter((row) => {
      const matchesSearch =
        !search.trim() ||
        row.id.toLowerCase().includes(search.trim().toLowerCase()) ||
        row.zone.toLowerCase().includes(search.trim().toLowerCase())
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(TOTAL_LOTS / PAGE_SIZE))

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: 'var(--color-text-primary)' }}>Quản lý lô đất</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            FR-10 · CRUD lô đất · Tổng {TOTAL_LOTS.toLocaleString('vi-VN')} lô
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ background: 'var(--color-accent-teal)', color: '#0A1628', fontWeight: 600, border: 'none', borderRadius: 7, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
          + Thêm lô mới
        </button>
      </header>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder="🔍 Tìm mã lô, khu vực..."
          style={{ ...inputStyle, minWidth: 220 }}
        />
        <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} style={inputStyle}>
          <option value="all">Tất cả khu</option>
          <option value="A">Khu A</option>
          <option value="B">Khu B</option>
          <option value="C">Khu C</option>
          <option value="D">Khu D</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }} style={inputStyle}>
          <option value="all">Tất cả trạng thái</option>
          <option value="available">Còn trống</option>
          <option value="sold">Đã có chủ</option>
          <option value="reserved">Đặt cọc</option>
          <option value="locked">Ngừng bán</option>
        </select>
        <select style={inputStyle}>
          <option>Kích thước: Tất cả</option>
          <option>Nhỏ (&lt;5m²)</option>
          <option>Vừa (5-8m²)</option>
          <option>Lớn (&gt;8m²)</option>
        </select>
      </div>

      <div style={{ ...panelStyle, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Mã lô', 'Khu vực', 'Kích thước', 'Hướng', 'Giá niêm yết', 'Trạng thái', 'Chủ sở hữu', ''].map((h) => (
                <th key={h} style={{ padding: '10px 16px', fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  Không tìm thấy lô đất nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--color-accent-teal)', fontWeight: 600 }}>{row.id}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{row.zone}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{row.size}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{row.direction}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-primary)' }}>{row.price.toLocaleString('vi-VN')} đ</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: STATUS_META[row.status].bg, color: STATUS_META[row.status].color, borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 600 }}>
                      {STATUS_META[row.status].label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{row.owner}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => setEditing(row)}
                      style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 6, padding: '5px 11px', fontSize: 11, cursor: 'pointer' }}>
                      ✏ Sửa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
        <span>Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, TOTAL_LOTS)} / {TOTAL_LOTS.toLocaleString('vi-VN')} lô</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ ...inputStyle, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>
            ← Trước
          </button>
          {[1, 2, 3].map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                background: page === p ? 'var(--color-accent-teal)' : inputStyle.background,
                color: page === p ? '#0A1628' : 'var(--color-text-secondary)',
                fontWeight: page === p ? 700 : 400,
              }}>
              {p}
            </button>
          ))}
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            Sau →
          </button>
        </div>
      </div>

      {/* Simple edit/create modal */}
      {(editing || showCreate) ? (
        <div
          onClick={() => { setEditing(null); setShowCreate(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ ...panelStyle, width: 420, padding: 22 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, color: 'var(--color-text-primary)' }}>
              {editing ? `Sửa lô ${editing.id}` : 'Thêm lô mới'}
            </h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--color-text-muted)' }}>
                Mã lô
                <input defaultValue={editing?.id} style={{ ...inputStyle, width: '100%' }} />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--color-text-muted)' }}>
                Khu vực
                <input defaultValue={editing?.zone} style={{ ...inputStyle, width: '100%' }} />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--color-text-muted)' }}>
                Giá niêm yết
                <input defaultValue={editing?.price} type="number" style={{ ...inputStyle, width: '100%' }} />
              </label>
              <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--color-text-muted)' }}>
                Trạng thái
                <select defaultValue={editing?.status ?? 'available'} style={{ ...inputStyle, width: '100%' }}>
                  <option value="available">Còn trống</option>
                  <option value="sold">Đã có chủ</option>
                  <option value="reserved">Đặt cọc</option>
                  <option value="locked">Ngừng bán</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setEditing(null); setShowCreate(false) }}
                style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 7, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                Hủy
              </button>
              <button
                onClick={() => { setEditing(null); setShowCreate(false) }}
                style={{ background: 'var(--color-accent-teal)', color: '#0A1628', fontWeight: 600, border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                Lưu
              </button>
            </div>
            {/* TODO: nối API thật, ví dụ api.post('/admin/lots') hoặc api.patch(`/admin/lots/${editing.id}`) */}
          </div>
        </div>
      ) : null}
    </div>
  )
}
