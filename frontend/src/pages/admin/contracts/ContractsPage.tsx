// src/pages/admin/contracts/ContractsPage.tsx
import { useMemo, useState } from 'react'

type ContractType = 'purchase' | 'transfer' | 'service' | 'inheritance'
type ContractStatus = 'active' | 'pending' | 'expiring' | 'expired'

interface ContractRow {
  id: string
  type: ContractType
  owner: string
  ownerInitials: string
  lot: string
  value: number
  signedAt: string
  expiresAt: string
  expiring?: boolean
  status: ContractStatus
  partyA: { name: string; code: string }
  partyB: { name: string; code: string }
  fees: number
  submittedAt: string
  files: string[]
}

const TYPE_META: Record<ContractType, { label: string; color: string; bg: string }> = {
  purchase:     { label: 'Mua lô', color: '#4A9EFF', bg: 'rgba(74,158,255,0.14)' },
  transfer:     { label: 'Chuyển nhượng', color: '#B497F0', bg: 'rgba(180,151,240,0.14)' },
  service:      { label: 'Dịch vụ', color: '#00C8A0', bg: 'rgba(0,200,160,0.14)' },
  inheritance:  { label: 'Thừa kế', color: '#F5A623', bg: 'rgba(245,166,35,0.16)' },
}

const STATUS_META: Record<ContractStatus, { label: string; color: string; bg: string }> = {
  active:   { label: 'Hiệu lực', color: '#00C8A0', bg: 'rgba(0,200,160,0.14)' },
  pending:  { label: 'Chờ duyệt', color: '#F5A623', bg: 'rgba(245,166,35,0.16)' },
  expiring: { label: 'Sắp hết hạn', color: '#FF5C5C', bg: 'rgba(255,92,92,0.14)' },
  expired:  { label: 'Hết hạn', color: '#8DA5C0', bg: 'rgba(141,165,192,0.14)' },
}

const CONTRACTS: ContractRow[] = [
  { id: 'HD-2025-0089', type: 'transfer', owner: 'Nguyễn Văn Thành', ownerInitials: 'NT', lot: 'A-12', value: 28500000, signedAt: '—', expiresAt: '2075', status: 'pending', partyA: { name: 'Nguyễn Văn Thành', code: 'KH-0142' }, partyB: { name: 'Nguyễn Thị Mai', code: '079 987 654 321' }, fees: 500000, submittedAt: '28/06/2025', files: ['CCCD_NguyenVanThanh.pdf', 'CCCD_NguyenThiMai.pdf', 'HopDong_Goc.pdf'] },
  { id: 'HD-2025-0082', type: 'purchase', owner: 'Lê Thị Hương', ownerInitials: 'LH', lot: 'B-05', value: 25000000, signedAt: '15/06/2025', expiresAt: '2075', status: 'active', partyA: { name: 'Vĩnh Phúc Viên', code: 'Chủ đầu tư' }, partyB: { name: 'Lê Thị Hương', code: 'KH-0138' }, fees: 0, submittedAt: '15/06/2025', files: ['CCCD_LeThiHuong.pdf', 'HopDong_Goc.pdf'] },
  { id: 'HD-2022-0031', type: 'service', owner: 'Phạm Văn Tuấn', ownerInitials: 'PT', lot: 'C-18', value: 6000000, signedAt: '01/07/2022', expiresAt: '31/07/2025', expiring: true, status: 'expiring', partyA: { name: 'Vĩnh Phúc Viên', code: 'Chủ đầu tư' }, partyB: { name: 'Phạm Văn Tuấn', code: 'KH-0155' }, fees: 0, submittedAt: '01/07/2022', files: ['HopDong_DichVu.pdf'] },
  { id: 'HD-2025-0079', type: 'inheritance', owner: 'Trần Văn Long', ownerInitials: 'TL', lot: 'D-07', value: 0, signedAt: '10/06/2025', expiresAt: '2072', status: 'active', partyA: { name: 'Trần Văn Long (cũ)', code: 'KH-0140' }, partyB: { name: 'Trần Văn Long', code: 'KH-0193' }, fees: 500000, submittedAt: '10/06/2025', files: ['DiChuc_CongChung.pdf', 'CCCD.pdf'] },
  { id: 'HD-2025-0071', type: 'purchase', owner: 'Nguyễn Bích Chi', ownerInitials: 'NB', lot: 'A-31', value: 28500000, signedAt: '02/06/2025', expiresAt: '2075', status: 'active', partyA: { name: 'Vĩnh Phúc Viên', code: 'Chủ đầu tư' }, partyB: { name: 'Nguyễn Bích Chi', code: 'KH-0127' }, fees: 0, submittedAt: '02/06/2025', files: ['CCCD_NguyenBichChi.pdf', 'HopDong_Goc.pdf'] },
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
  return (
    <span style={{ background: bg, color, borderRadius: 20, padding: '3px 9px', fontSize: 11, fontWeight: 600 }}>{label}</span>
  )
}

export default function ContractsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | ContractType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('all')
  const [selectedId, setSelectedId] = useState(CONTRACTS[0].id)

  const filtered = useMemo(() => {
    return CONTRACTS.filter((c) => {
      const matchesSearch =
        !search.trim() ||
        c.id.toLowerCase().includes(search.trim().toLowerCase()) ||
        c.owner.toLowerCase().includes(search.trim().toLowerCase()) ||
        c.lot.toLowerCase().includes(search.trim().toLowerCase())
      const matchesType = typeFilter === 'all' || c.type === typeFilter
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter
      return matchesSearch && matchesType && matchesStatus
    })
  }, [search, typeFilter, statusFilter])

  const selected = CONTRACTS.find((c) => c.id === selectedId) ?? filtered[0] ?? CONTRACTS[0]

  const total = CONTRACTS.length
  const activeCount = CONTRACTS.filter((c) => c.status === 'active').length
  const pendingCount = CONTRACTS.filter((c) => c.status === 'pending').length
  const transferCount = CONTRACTS.filter((c) => c.type === 'transfer').length

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: 'var(--color-text-primary)' }}>Hợp đồng &amp; Sổ hữu</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            FR-12 · Hồ sơ sở hữu &amp; giao dịch · {activeCount} hợp đồng đang hiệu lực
          </p>
        </div>
        <button style={{ background: 'var(--color-accent-teal)', color: '#0A1628', fontWeight: 600, border: 'none', borderRadius: 7, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}>
          + Tạo hợp đồng
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)' }}>{total}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Tổng hợp đồng</div>
        </div>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#00C8A0' }}>{activeCount}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Đang hiệu lực</div>
        </div>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#FF5C5C' }}>{pendingCount}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Chờ duyệt hôm nay</div>
        </div>
        <div style={{ ...panelStyle, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#F5A623' }}>{transferCount}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Chuyển nhượng</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Tìm mã HĐ, tên KH, số lô..." style={{ ...inputStyle, minWidth: 240 }} />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} style={inputStyle}>
          <option value="all">Loại HĐ: Tất cả</option>
          <option value="purchase">Mua lô</option>
          <option value="transfer">Chuyển nhượng</option>
          <option value="service">Dịch vụ</option>
          <option value="inheritance">Thừa kế</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} style={inputStyle}>
          <option value="all">Trạng thái: Tất cả</option>
          <option value="active">Hiệu lực</option>
          <option value="pending">Chờ duyệt</option>
          <option value="expiring">Sắp hết hạn</option>
          <option value="expired">Hết hạn</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1.3fr) minmax(320px, 1fr)', gap: 16 }}>
        <div style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Danh sách hợp đồng
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Mã HĐ', 'Loại', 'Chủ sở hữu', 'Lô đất', 'Giá trị', 'Hết hạn'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: selectedId === c.id ? 'rgba(0,200,160,0.08)' : 'transparent' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--color-accent-teal)', fontWeight: 600 }}>{c.id}</td>
                  <td style={{ padding: '12px 16px' }}><Pill label={TYPE_META[c.type].label} color={TYPE_META[c.type].color} bg={TYPE_META[c.type].bg} /></td>
                  <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,200,160,0.14)', color: 'var(--color-accent-teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{c.ownerInitials}</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>{c.owner}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{c.lot}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-primary)' }}>{c.value.toLocaleString('vi-VN')} đ</td>
                  <td style={{ padding: '12px 16px', color: c.expiring ? '#FF5C5C' : 'var(--color-text-secondary)' }}>{c.expiresAt}{c.expiring ? ' ⚠' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 18px', fontSize: 12, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}>
            Hiển thị 1–{filtered.length} / {total} hợp đồng
          </div>
        </div>

        <div style={{ ...panelStyle, padding: 20, alignSelf: 'start' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Mã hợp đồng</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-accent-teal)' }}>{selected.id}</div>
            </div>
            <Pill label={STATUS_META[selected.status].label} color={STATUS_META[selected.status].color} bg={STATUS_META[selected.status].bg} />
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Thông tin chung</div>
          <div style={{ display: 'grid', gap: 8, fontSize: 12.5, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-secondary)' }}>Loại hợp đồng</span><span style={{ color: 'var(--color-text-primary)' }}>{TYPE_META[selected.type].label}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-secondary)' }}>Lô phần mộ</span><span style={{ color: 'var(--color-text-primary)' }}>{selected.lot}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-secondary)' }}>Giá trị giao dịch</span><span style={{ color: 'var(--color-accent-teal)' }}>{selected.value.toLocaleString('vi-VN')} đ</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-secondary)' }}>Phí thủ tục</span><span style={{ color: 'var(--color-text-primary)' }}>{selected.fees.toLocaleString('vi-VN')} đ</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--color-text-secondary)' }}>Ngày nộp hồ sơ</span><span style={{ color: 'var(--color-text-primary)' }}>{selected.submittedAt}</span></div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0 0 16px' }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Bên A → Bên B</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: 10, background: 'var(--color-bg-secondary)', borderRadius: 7, fontSize: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 3 }}>Bên A</div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{selected.partyA.name}</div>
              <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>{selected.partyA.code}</div>
            </div>
            <div style={{ padding: 10, background: 'var(--color-bg-secondary)', borderRadius: 7, fontSize: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 3 }}>Bên B</div>
              <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{selected.partyB.name}</div>
              <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>{selected.partyB.code}</div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0 0 16px' }} />
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Hồ sơ đính kèm</div>
          <div style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
            {selected.files.map((file) => (
              <div key={file} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 7, fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>📄 {file}</span>
                <span style={{ color: 'var(--color-accent-teal)', cursor: 'pointer' }}>Xem</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={selected.status !== 'pending'}
              style={{ flex: 1, background: 'var(--color-accent-teal)', color: '#0A1628', fontWeight: 600, border: 'none', borderRadius: 7, padding: '9px 0', fontSize: 13, cursor: selected.status === 'pending' ? 'pointer' : 'not-allowed', opacity: selected.status === 'pending' ? 1 : 0.5 }}>
              ✓ Phê duyệt
            </button>
            <button style={{ flex: 1, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 7, padding: '9px 0', fontSize: 13, cursor: 'pointer' }}>
              In HĐ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
