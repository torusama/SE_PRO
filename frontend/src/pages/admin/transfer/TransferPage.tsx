// src/pages/admin/transfer/TransferPage.tsx
import { useMemo, useState } from 'react'

type TransferType = 'transfer' | 'inheritance'
type TransferStatus = 'pending' | 'processing' | 'done' | 'rejected'

interface TransferRow {
  id: string
  type: TransferType
  from: string
  to: string
  lot: string
  fee: number
  submittedAt: string
  status: TransferStatus
}

const TYPE_META: Record<TransferType, { label: string; color: string; bg: string }> = {
  transfer:    { label: 'Chuyển nhượng', color: '#B497F0', bg: 'rgba(180,151,240,0.14)' },
  inheritance: { label: 'Thừa kế', color: '#F5A623', bg: 'rgba(245,166,35,0.16)' },
}

const STATUS_META: Record<TransferStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Chờ duyệt', color: '#F5A623', bg: 'rgba(245,166,35,0.16)' },
  processing: { label: 'Đang xử lý', color: '#4A9EFF', bg: 'rgba(74,158,255,0.14)' },
  done:       { label: 'Hoàn thành', color: '#00C8A0', bg: 'rgba(0,200,160,0.14)' },
  rejected:   { label: 'Từ chối', color: '#FF5C5C', bg: 'rgba(255,92,92,0.14)' },
}

const INITIAL_ROWS: TransferRow[] = [
  { id: 'CN-2025-0089', type: 'transfer', from: 'Nguyễn Văn Thành', to: 'Nguyễn Thị Mai', lot: 'A-12', fee: 500000, submittedAt: '28/06/2025', status: 'pending' },
  { id: 'CN-2025-0079', type: 'inheritance', from: 'Trần Văn Long', to: 'Đặng Minh Khoa', lot: 'D-07', fee: 500000, submittedAt: '27/06/2025', status: 'pending' },
  { id: 'CN-2025-0071', type: 'transfer', from: 'Lê Hoàng Nam', to: 'Trịnh Minh Trí', lot: 'B-11', fee: 500000, submittedAt: '20/06/2025', status: 'processing' },
  { id: 'CN-2025-0065', type: 'inheritance', from: 'Phan Thị Thu', to: 'Phan Minh Hiếu', lot: 'A-09', fee: 0, submittedAt: '15/06/2025', status: 'done' },
  { id: 'CN-2025-0058', type: 'transfer', from: 'Võ Thanh Hải', to: 'Lý Minh Đức', lot: 'C-05', fee: 500000, submittedAt: '10/06/2025', status: 'done' },
  { id: 'CN-2025-0050', type: 'transfer', from: 'Đỗ Văn Minh', to: '—', lot: 'B-18', fee: 500000, submittedAt: '05/06/2025', status: 'rejected' },
]

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

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ background: bg, color, borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 600 }}>{label}</span>
}

export default function TransferPage() {
  const [rows, setRows] = useState(INITIAL_ROWS)
  const [search, setSearch] = useState('')
  const [typeTab, setTypeTab] = useState<'all' | TransferType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | TransferStatus>('all')

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch =
        !search.trim() ||
        r.id.toLowerCase().includes(search.trim().toLowerCase()) ||
        r.from.toLowerCase().includes(search.trim().toLowerCase()) ||
        r.to.toLowerCase().includes(search.trim().toLowerCase())
      const matchesType = typeTab === 'all' || r.type === typeTab
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter
      return matchesSearch && matchesType && matchesStatus
    })
  }, [rows, search, typeTab, statusFilter])

  const thisMonth = rows.length + 9
  const inheritanceProcessing = rows.filter((r) => r.type === 'inheritance' && r.status === 'processing').length || 3
  const doneCount = rows.filter((r) => r.status === 'done').length
  const rejectedCount = rows.filter((r) => r.status === 'rejected').length

  function approve(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'processing' } : r)))
    // TODO: gọi api.patch(`/admin/transfers/${id}/approve`)
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: 'var(--color-text-primary)' }}>Chuyển nhượng</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            FR-05 · Quản lý chuyển nhượng &amp; thừa kế
          </p>
        </div>
        <button style={{ background: 'var(--color-accent-teal)', color: '#0A1628', fontWeight: 600, border: 'none', borderRadius: 7, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
          + Tạo yêu cầu
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#B497F0' }}>{thisMonth}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Chuyển nhượng tháng này</div>
        </div>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#F5A623' }}>{inheritanceProcessing}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Thừa kế đang xử lý</div>
        </div>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#00C8A0' }}>{doneCount}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Hoàn thành</div>
        </div>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#FF5C5C' }}>{rejectedCount}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Từ chối</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Tìm mã yêu cầu, tên KH..." style={{ ...inputStyle, minWidth: 220 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'transfer', 'inheritance'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeTab(t)}
              style={{
                border: '1px solid var(--color-border)',
                background: typeTab === t ? 'rgba(0,200,160,0.14)' : 'transparent',
                color: typeTab === t ? 'var(--color-accent-teal)' : 'var(--color-text-secondary)',
                borderRadius: 7,
                padding: '6px 12px',
                fontSize: 12,
                cursor: 'pointer',
              }}>
              {t === 'all' ? 'Tất cả' : t === 'transfer' ? 'Chuyển nhượng' : 'Thừa kế'}
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={{ ...inputStyle, marginLeft: 'auto' }}>
          <option value="all">Trạng thái: Tất cả</option>
          <option value="pending">Chờ duyệt</option>
          <option value="processing">Đang xử lý</option>
          <option value="done">Hoàn thành</option>
          <option value="rejected">Từ chối</option>
        </select>
      </div>

      <div style={{ ...panelStyle, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Mã yêu cầu', 'Loại', 'Bên chuyển', 'Bên nhận', 'Lô đất', 'Phí', 'Ngày nộp', 'Trạng thái', ''].map((h) => (
                <th key={h} style={{ padding: '10px 16px', fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Không có yêu cầu nào khớp bộ lọc.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--color-accent-teal)', fontWeight: 600 }}>{r.id}</td>
                  <td style={{ padding: '12px 16px' }}><Pill label={TYPE_META[r.type].label} color={TYPE_META[r.type].color} bg={TYPE_META[r.type].bg} /></td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{r.from}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{r.to}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{r.lot}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-primary)' }}>{r.fee.toLocaleString('vi-VN')} đ</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{r.submittedAt}</td>
                  <td style={{ padding: '12px 16px' }}><Pill label={STATUS_META[r.status].label} color={STATUS_META[r.status].color} bg={STATUS_META[r.status].bg} /></td>
                  <td style={{ padding: '12px 16px' }}>
                    {r.status === 'pending' ? (
                      <button onClick={() => approve(r.id)} style={{ background: 'var(--color-accent-teal)', color: '#0A1628', fontWeight: 600, border: 'none', borderRadius: 6, padding: '5px 11px', fontSize: 11, cursor: 'pointer' }}>
                        Duyệt
                      </button>
                    ) : (
                      <button style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 6, padding: '5px 11px', fontSize: 11, cursor: 'pointer' }}>
                        Chi tiết
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
