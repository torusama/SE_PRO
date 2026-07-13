// src/pages/admin/notification-management/NotificationManagementPage.tsx
import { useState } from 'react'

interface SystemNotif {
  id: string
  icon: string
  iconBg: string
  title: string
  desc: string
  time: string
  unread?: boolean
  action?: string
  broadcast?: boolean
}

const INITIAL_NOTIFS: SystemNotif[] = [
  { id: 'n1', icon: '🚨', iconBg: 'rgba(255,92,92,0.14)', title: 'Hợp đồng HD-2022-0031 sắp hết hạn', desc: 'Hợp đồng dịch vụ của Phạm Văn Tuấn (lô C-18) hết hạn 31/07/2025. Cần liên hệ gia hạn.', time: '09:00', unread: true, action: 'Liên hệ KH' },
  { id: 'n3', icon: '💰', iconBg: 'rgba(212,168,67,0.14)', title: 'Thanh toán thành công — 28.500.000 đ', desc: 'Nguyễn Bích Chi (KH-0127) đã thanh toán hợp đồng HD-2025-0071. Biên lai đã gửi email.', time: 'Hôm qua' },
  { id: 'n4', icon: '📢', iconBg: 'rgba(74,158,255,0.14)', title: 'Broadcast đã gửi — 247 khách hàng', desc: 'Thông báo lịch bảo trì khu A đã gửi thành công. Tỷ lệ đọc: 84%.', time: '25/06', broadcast: true },
]

const AUDIENCE_OPTIONS = ['Tất cả khách hàng (247)', 'Khu A (80 KH)', 'Khu B (70 KH)', 'Khu C (60 KH)', 'HĐ sắp hết hạn']
const TYPE_OPTIONS = ['📢 Thông báo chung', '💰 Nhắc thanh toán', '🛠️ Lịch bảo trì', '⚠️ Cảnh báo khẩn']
const TABS = ['Tất cả', 'Chưa đọc', 'Broadcast'] as const

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
  padding: '8px 10px',
  fontSize: 12.5,
  width: '100%',
}

export default function NotificationManagementPage() {
  const [notifs, setNotifs] = useState(INITIAL_NOTIFS)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Tất cả')
  const [audience, setAudience] = useState(AUDIENCE_OPTIONS[0])
  const [notifType, setNotifType] = useState(TYPE_OPTIONS[0])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [channels, setChannels] = useState({ inApp: true, email: true, sms: false })
  const [sentMessage, setSentMessage] = useState('')

  const visibleNotifs = notifs.filter((n) => {
    if (tab === 'Chưa đọc') return n.unread
    if (tab === 'Broadcast') return n.broadcast
    return true
  })

  function handleSend() {
    if (!title.trim() || !content.trim()) {
      setSentMessage('Vui lòng nhập đầy đủ tiêu đề và nội dung.')
      return
    }
    const newNotif: SystemNotif = {
      id: `n${Date.now()}`,
      icon: '📢',
      iconBg: 'rgba(74,158,255,0.14)',
      title,
      desc: `Gửi tới ${audience} · Kênh: ${[channels.inApp && 'In-app', channels.email && 'Email', channels.sms && 'SMS'].filter(Boolean).join(', ')}`,
      time: 'Vừa xong',
      broadcast: true,
    }
    setNotifs((prev) => [newNotif, ...prev])
    setSentMessage(`Đã gửi thông báo tới ${audience}.`)
    setTitle('')
    setContent('')
    // TODO: gọi api.post('/admin/notifications/broadcast', { audience, notifType, title, content, channels })
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, color: 'var(--color-text-primary)' }}>Thông báo hệ thống</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            FR-09 · Broadcast &amp; quản lý thông báo tới khách hàng
          </p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div style={{ ...panelStyle, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>Thông báo hệ thống gần đây</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    border: '1px solid var(--color-border)',
                    background: tab === t ? 'rgba(0,200,160,0.14)' : 'transparent',
                    color: tab === t ? 'var(--color-accent-teal)' : 'var(--color-text-secondary)',
                    borderRadius: 6,
                    padding: '3px 10px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: 12, display: 'grid', gap: 10 }}>
            {visibleNotifs.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Không có thông báo nào.</div>
            ) : (
              visibleNotifs.map((n) => (
                <div key={n.id} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 9, background: n.unread ? 'rgba(0,200,160,0.05)' : 'transparent', border: '1px solid var(--color-border)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: n.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{n.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3 }}>{n.desc}</div>
                    {n.action ? (
                      <button style={{ marginTop: 8, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 6, padding: '5px 11px', fontSize: 11, cursor: 'pointer' }}>
                        {n.action}
                      </button>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{n.time}</span>
                    {n.unread ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF5C5C' }} /> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ ...panelStyle, padding: 20, alignSelf: 'start' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 16 }}>📢 Soạn thông báo</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
              Gửi đến
              <select value={audience} onChange={(e) => setAudience(e.target.value)} style={inputStyle}>
                {AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
              Loại thông báo
              <select value={notifType} onChange={(e) => setNotifType(e.target.value)} style={inputStyle}>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
              Tiêu đề
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tiêu đề thông báo..." style={inputStyle} />
            </label>
            <label style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--color-text-muted)' }}>
              Nội dung
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Soạn nội dung thông báo..." style={{ ...inputStyle, resize: 'vertical' }} />
            </label>
            <div style={{ display: 'grid', gap: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Kênh gửi</span>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={channels.inApp} onChange={(e) => setChannels((c) => ({ ...c, inApp: e.target.checked }))} /> In-app
                </label>
                <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={channels.email} onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))} /> Email
                </label>
                <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={channels.sms} onChange={(e) => setChannels((c) => ({ ...c, sms: e.target.checked }))} /> SMS
                </label>
              </div>
            </div>

            {sentMessage ? <div style={{ fontSize: 12, color: 'var(--color-accent-teal)' }}>{sentMessage}</div> : null}

            <button onClick={handleSend} style={{ background: 'var(--color-accent-teal)', color: '#ffffff', fontWeight: 600, border: 'none', borderRadius: 7, padding: '10px 0', fontSize: 13, cursor: 'pointer' }}>
              📤 Gửi ngay
            </button>
            <button style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', borderRadius: 7, padding: '10px 0', fontSize: 13, cursor: 'pointer' }}>
              🕐 Lên lịch gửi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
