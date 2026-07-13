// src/pages/admin/activity/ActivityPage.tsx
import { useMemo, useState } from 'react'

type EventType = 'Hợp đồng' | 'Dịch vụ' | 'Thanh toán' | 'Hệ thống'

interface ActivityEvent {
  id: number
  date: string
  time: string
  type: EventType
  icon: string
  active?: boolean
  title: string
  desc: string
}

const EVENTS: ActivityEvent[] = [
  { id: 2, date: '28/06/2025', time: '08:52', type: 'Hệ thống', icon: '✅', active: true, title: 'Hệ thống AI xác nhận hồ sơ tự động', desc: 'Auto-check · Đầy đủ hồ sơ · Chờ admin duyệt' },
  { id: 3, date: '28/06/2025', time: '08:30', type: 'Dịch vụ', icon: '🛠️', title: 'Yêu cầu dịch vụ lau dọn lô B-05', desc: 'Lê Thị Hương · KH-0138 · Ngày thực hiện: 02/07' },
  { id: 4, date: '27/06/2025', time: '16:40', type: 'Thanh toán', icon: '💰', title: 'Thanh toán hợp đồng HD-2025-0071 — 28.500.000 đ', desc: 'Nguyễn Bích Chi · KH-0127 · Chuyển khoản VietinBank' },
  { id: 6, date: '26/06/2025', time: '11:00', type: 'Hợp đồng', icon: '📄', active: true, title: 'Ký hợp đồng HD-2025-0082 hoàn tất', desc: 'Lê Thị Hương · KH-0138 · Mua lô B-05 · 25.000.000 đ' },
]

const TYPE_OPTIONS: (EventType | 'Tất cả')[] = ['Tất cả', 'Hợp đồng', 'Dịch vụ', 'Thanh toán', 'Hệ thống']
const RANGE_OPTIONS = ['Hôm nay', '7 ngày', '30 ngày', 'Tất cả'] as const

const panelStyle: React.CSSProperties = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
}

function exportToCsv(rows: ActivityEvent[]) {
  const header = ['Ngày', 'Giờ', 'Loại', 'Nội dung', 'Chi tiết']
  const body = rows.map((r) => [r.date, r.time, r.type, r.title, r.desc])
  const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `hoat-dong-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function ActivityPage() {
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_OPTIONS)[number]>('Tất cả')
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>('Hôm nay')

  const filtered = useMemo(
    () => EVENTS.filter((event) => typeFilter === 'Tất cả' || event.type === typeFilter),
    [typeFilter],
  )

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: 'var(--color-text-primary)' }}>Hoạt động gần đây</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Tất cả sự kiện trong hệ thống theo thời gian thực
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              borderRadius: 7,
              padding: '7px 10px',
              fontSize: 12,
            }}>
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'Tất cả' ? 'Tất cả loại' : opt}
              </option>
            ))}
          </select>
          <button
            onClick={() => exportToCsv(filtered)}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              borderRadius: 7,
              padding: '7px 14px',
              fontSize: 12,
              cursor: 'pointer',
            }}>
            ⬇ Xuất CSV
          </button>
        </div>
      </header>

      <div style={panelStyle}>
        <div style={{ padding: '16px 20px 0', display: 'flex', gap: 8 }}>
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setRange(opt)}
              style={{
                border: '1px solid var(--color-border)',
                background: range === opt ? 'rgba(0,200,160,0.14)' : 'transparent',
                color: range === opt ? 'var(--color-accent-teal)' : 'var(--color-text-secondary)',
                fontWeight: range === opt ? 600 : 400,
                borderRadius: 7,
                padding: '6px 12px',
                fontSize: 12,
                cursor: 'pointer',
              }}>
              {opt}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {filtered.length === 0 ? (
            <div style={{ color: 'var(--color-text-secondary)', padding: 20, textAlign: 'center' }}>
              Không có sự kiện nào khớp bộ lọc.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 0, position: 'relative' }}>
              {filtered.map((event, idx) => (
                <div key={event.id} style={{ display: 'flex', gap: 14, paddingBottom: idx === filtered.length - 1 ? 0 : 18, position: 'relative' }}>
                  {idx !== filtered.length - 1 ? (
                    <div style={{ position: 'absolute', left: 15, top: 32, bottom: 0, width: 1, background: 'var(--color-border)' }} />
                  ) : null}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: event.active ? 'rgba(0,200,160,0.16)' : 'var(--color-bg-secondary)',
                      border: `1px solid ${event.active ? 'var(--color-accent-teal)' : 'var(--color-border)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      flexShrink: 0,
                      zIndex: 1,
                    }}>
                    {event.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {event.date} · {event.time}
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--color-text-primary)', fontWeight: 500, marginTop: 2 }}>{event.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{event.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
