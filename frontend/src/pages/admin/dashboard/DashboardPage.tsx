// src/pages/admin/dashboard/DashboardPage.tsx
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'

const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

const panelStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e2da',
  borderRadius: 10,
}

interface StatCardProps {
  icon: string
  iconBg: string
  value: string
  label: string
  trend?: string
  trendColor?: string
}

function StatCard({ icon, iconBg, value, label, trend, trendColor }: StatCardProps) {
  return (
    <div style={{ ...panelStyle, padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 9,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{label}</div>
        {trend ? (
          <div style={{ fontSize: 11, marginTop: 6, color: trendColor ?? 'var(--color-accent-teal)' }}>{trend}</div>
        ) : null}
      </div>
    </div>
  )
}

const monthlyContracts = [
  { label: 'T1', value: 45 },
  { label: 'T2', value: 62 },
  { label: 'T3', value: 38 },
  { label: 'T4', value: 75 },
  { label: 'T5', value: 55 },
  { label: 'T6', value: 88 },
]

const lotStatusBreakdown = [
  { label: 'Còn trống', value: 600, color: '#00C8A0' },
  { label: 'Đã có chủ', value: 500, color: '#F5A623' },
  { label: 'Đặt cọc', value: 100, color: '#818cf8' },
  { label: 'Ngừng bán', value: 40, color: 'var(--color-border)' },
]

const recentActivity: { time: string; type: string; typeColor: string; typeBg: string; content: string; user: string; status: string; statusColor: string; statusBg: string }[] = [
  { time: '09:15', type: 'Hợp đồng', typeColor: '#00C8A0', typeBg: 'rgba(0,200,160,0.14)', content: 'Nộp hồ sơ HD-2025-0089', user: 'Nguyễn Văn Thành', status: 'Chờ duyệt', statusColor: '#F5A623', statusBg: 'rgba(245,166,35,0.16)' },
  { time: '08:52', type: 'Dịch vụ', typeColor: '#4A9EFF', typeBg: 'rgba(74,158,255,0.14)', content: 'Đặt dịch vụ lau dọn lô A-22', user: 'Lê Thị Hương', status: 'Đã xác nhận', statusColor: '#00C8A0', statusBg: 'rgba(0,200,160,0.14)' },
  { time: '08:30', type: 'Chuyển nhượng', typeColor: '#B497F0', typeBg: 'rgba(180,151,240,0.14)', content: 'Yêu cầu chuyển nhượng lô B-05', user: 'Phạm Văn Tuấn', status: 'Đang xử lý', statusColor: '#F5A623', statusBg: 'rgba(245,166,35,0.16)' },
  { time: 'Hôm qua', type: 'Hợp đồng', typeColor: '#00C8A0', typeBg: 'rgba(0,200,160,0.14)', content: 'Ký hợp đồng HD-2025-0082', user: 'KH-0138', status: 'Hoàn thành', statusColor: '#00C8A0', statusBg: 'rgba(0,200,160,0.14)' },
  { time: 'Hôm qua', type: 'Thanh toán', typeColor: '#FF5C5C', typeBg: 'rgba(255,92,92,0.14)', content: 'Quá hạn thanh toán lô C-18', user: 'Phạm Văn Tuấn', status: 'Cần xử lý', statusColor: '#FF5C5C', statusBg: 'rgba(255,92,92,0.14)' },
]

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: bg,
      }}>
      {label}
    </span>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const total = lotStatusBreakdown.reduce((sum, item) => sum + item.value, 0)
  const maxMonthly = Math.max(...monthlyContracts.map((m) => m.value))

  return (
    <div style={{ display: 'grid', gap: 24 }}>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard icon="🏠" iconBg="rgba(0,200,160,0.14)" value="1,240" label="Tổng lô đất" trend="↑ 3 lô mới tháng này" />
        <StatCard icon="📄" iconBg="rgba(212,168,67,0.14)" value="247" label="Hợp đồng đang hiệu lực" trend="88.7% tỷ lệ hiệu lực" />
        <StatCard icon="⏳" iconBg="rgba(255,92,92,0.14)" value="8" label="Chờ duyệt hôm nay" trend="↑ 3 so với hôm qua" trendColor="#FF5C5C" />
        <StatCard icon="💰" iconBg="rgba(74,158,255,0.14)" value="2.4 tỷ" label="Doanh thu tháng 6" trend="↑ 12% so với T5" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div style={{ ...panelStyle, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Hợp đồng theo tháng</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 16 }}>6 tháng gần nhất · 2025</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {monthlyContracts.map((m) => (
              <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: '100%',
                    height: `${(m.value / maxMonthly) * 100}%`,
                    background: m.value === maxMonthly ? 'var(--color-accent-teal)' : 'rgba(0,200,160,0.18)',
                    borderTop: `2px solid ${m.value === maxMonthly ? '#00A884' : 'var(--color-accent-teal)'}`,
                    borderRadius: '4px 4px 0 0',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...panelStyle, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Trạng thái lô đất</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 16 }}>Tính đến hôm nay</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <svg width="90" height="90" viewBox="0 0 90 90">
              {(() => {
                let offset = 0
                const circumference = 2 * Math.PI * 35
                return lotStatusBreakdown.map((item) => {
                  const length = (item.value / total) * circumference
                  const circle = (
                    <circle
                      key={item.label}
                      cx="45"
                      cy="45"
                      r="35"
                      fill="none"
                      stroke={item.color}
                      strokeWidth="14"
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={-offset}
                      strokeLinecap="round"
                      transform="rotate(-90 45 45)"
                    />
                  )
                  offset += length
                  return circle
                })
              })()}
              <text x="45" y="49" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--color-text-primary)">
                {money.format(total)}
              </text>
            </svg>
            <div style={{ display: 'grid', gap: 6 }}>
              {lotStatusBreakdown.map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                  {item.label} · {item.value}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ ...panelStyle, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Hoạt động mới nhất</div>
          <button
            onClick={() => navigate(ROUTES.ADMIN_ACTIVITY)}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              borderRadius: 7,
              padding: '5px 11px',
              fontSize: 11,
              cursor: 'pointer',
            }}>
            Xem tất cả →
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Thời gian', 'Loại', 'Nội dung', 'Người dùng', 'Trạng thái'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 16px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    textAlign: 'left',
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentActivity.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: idx === recentActivity.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 20px', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{row.time}</td>
                <td style={{ padding: '12px 20px' }}>
                  <Pill label={row.type} color={row.typeColor} bg={row.typeBg} />
                </td>
                <td style={{ padding: '12px 20px', fontSize: 12.5, color: 'var(--color-text-primary)' }}>{row.content}</td>
                <td style={{ padding: '12px 20px', fontSize: 12.5, color: 'var(--color-text-secondary)' }}>{row.user}</td>
                <td style={{ padding: '12px 20px' }}>
                  <Pill label={row.status} color={row.statusColor} bg={row.statusBg} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
