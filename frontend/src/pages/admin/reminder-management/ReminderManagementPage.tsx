// src/pages/admin/reminder-management/ReminderManagementPage.tsx
// Bản đối chứng phía Admin cho FR-08 (customer đã có ở
// src/pages/customer/reminder/RemindersPage.tsx, gọi /my/reminders).
// Trang này cho phép Admin xem TOÀN BỘ nhắc lịch (ngày giỗ, tưởng niệm,
// chăm sóc mộ...) của mọi khách hàng để chủ động chuẩn bị / liên hệ,
// và gửi nhắc thủ công ngay khi cần (vd: KH tắt thông báo app nhưng
// nhân viên vẫn muốn gọi điện nhắc trước).
//
// Giả định API backend (cùng nhóm với /my/reminders):
//   GET   /admin/reminders?type=&upcomingDays=&search=   -> AdminReminder[]
//   POST  /admin/reminders/:id/notify-now                -> gửi nhắc ngay
// Nếu backend đặt tên khác, chỉ cần sửa 2 dòng gọi api bên dưới.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import './ReminderManagementPage.css'

type ReminderType = 'death_anniversary' | 'memorial' | 'maintenance' | 'other'

interface AdminReminder {
  id: number
  title: string
  reminderType: ReminderType
  isRecurring: boolean
  notifyDaysBefore: number
  isActive: boolean
  nextDate: string | null
  daysUntil: number | null
  customerName: string
  customerPhone?: string | null
  plotCode?: string | null
  zoneName?: string | null
  lastNotifiedAt?: string | null
}

const TYPE_META: Record<ReminderType, { icon: string; label: string }> = {
  death_anniversary: { icon: '🕯️', label: 'Ngày giỗ' },
  memorial: { icon: '🙏', label: 'Tưởng niệm' },
  maintenance: { icon: '🧹', label: 'Chăm sóc mộ' },
  other: { icon: '🔔', label: 'Khác' },
}

const TYPE_FILTERS: { value: ReminderType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tất cả loại' },
  { value: 'death_anniversary', label: 'Ngày giỗ' },
  { value: 'memorial', label: 'Tưởng niệm' },
  { value: 'maintenance', label: 'Chăm sóc mộ' },
  { value: 'other', label: 'Khác' },
]

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return 'Không tải được danh sách nhắc lịch. Vui lòng thử lại.'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

function dayBadge(r: AdminReminder) {
  if (r.daysUntil === null) return { cls: 'past', text: 'Không lặp lại' }
  if (r.daysUntil === 0) return { cls: 'today', text: 'Hôm nay' }
  if (r.daysUntil <= r.notifyDaysBefore) return { cls: 'soon', text: `Còn ${r.daysUntil} ngày` }
  return { cls: 'far', text: `Còn ${r.daysUntil} ngày` }
}

export default function ReminderManagementPage() {
  const [reminders, setReminders] = useState<AdminReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ReminderType | 'all'>('all')
  const [rangeFilter, setRangeFilter] = useState<'all' | 7 | 30>('all')

  const [notifyingId, setNotifyingId] = useState<number | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<{ success: boolean; data: { items: AdminReminder[] } }>('/admin/reminders', {
        params: { page: 1, pageSize: 100 },
      })
      setReminders(res.data.data?.items ?? [])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return reminders
      .filter((r) => (typeFilter === 'all' ? true : r.reminderType === typeFilter))
      .filter((r) => (rangeFilter === 'all' ? true : r.daysUntil !== null && r.daysUntil >= 0 && r.daysUntil <= rangeFilter))
      .filter((r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.plotCode ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => {
        if (a.daysUntil === null) return 1
        if (b.daysUntil === null) return -1
        return a.daysUntil - b.daysUntil
      })
  }, [reminders, search, typeFilter, rangeFilter])

  const stats = useMemo(() => {
    const active = reminders.filter((r) => r.isActive)
    const within7 = active.filter((r) => r.daysUntil !== null && r.daysUntil >= 0 && r.daysUntil <= 7).length
    const within30 = active.filter((r) => r.daysUntil !== null && r.daysUntil >= 0 && r.daysUntil <= 30).length
    const deathAnniv = active.filter((r) => r.reminderType === 'death_anniversary').length
    return { total: reminders.length, within7, within30, deathAnniv }
  }, [reminders])

  async function notifyNow(id: number) {
    setNotifyingId(id)
    setToast('')
    try {
      await api.post(`/admin/reminders/${id}/notify-now`)
      setToast('Đã gửi nhắc nhở tới khách hàng.')
      await load()
    } catch (err) {
      setToast(getErrorMessage(err))
    } finally {
      setNotifyingId(null)
    }
  }

  return (
    <div className="admin-theme reminder-admin">
      <header className="reminder-admin-header">
        <div>
          <p>QUẢN LÝ NHẮC LỊCH</p>
          <h1>Nhắc Lịch Ngày Giỗ &amp; Sự Kiện</h1>
          <span className="reminder-admin-desc">
            Theo dõi toàn bộ nhắc lịch của khách hàng để chủ động chuẩn bị dịch vụ và liên hệ đúng lúc.
          </span>
        </div>
      </header>

      <section className="reminder-stat-grid">
        <div className="reminder-stat-card">
          <div className="reminder-stat-value">{stats.total}</div>
          <div className="reminder-stat-label">Tổng số nhắc lịch</div>
        </div>
        <div className="reminder-stat-card highlight">
          <div className="reminder-stat-value">{stats.within7}</div>
          <div className="reminder-stat-label">Sắp đến trong 7 ngày</div>
        </div>
        <div className="reminder-stat-card">
          <div className="reminder-stat-value">{stats.within30}</div>
          <div className="reminder-stat-label">Sắp đến trong 30 ngày</div>
        </div>
        <div className="reminder-stat-card">
          <div className="reminder-stat-value">{stats.deathAnniv}</div>
          <div className="reminder-stat-label">Ngày giỗ đang theo dõi</div>
        </div>
      </section>

      <section className="reminder-toolbar">
        <input
          className="reminder-search"
          placeholder="Tìm theo tên khách hàng, sự kiện hoặc mã lô..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ReminderType | 'all')}>
          {TYPE_FILTERS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select value={rangeFilter} onChange={(e) => setRangeFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 7 | 30))}>
          <option value="all">Mọi thời điểm</option>
          <option value={7}>Trong 7 ngày tới</option>
          <option value={30}>Trong 30 ngày tới</option>
        </select>
      </section>

      {toast && <div className="reminder-toast">{toast}</div>}
      {error && <div className="reminder-error">{error}</div>}

      {loading ? (
        <div className="reminder-empty">Đang tải danh sách nhắc lịch...</div>
      ) : filtered.length === 0 ? (
        <div className="reminder-empty">Không có nhắc lịch nào khớp bộ lọc hiện tại.</div>
      ) : (
        <section className="reminder-table-wrap">
          <table className="reminder-table">
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Sự kiện</th>
                <th>Loại</th>
                <th>Lô phần mộ</th>
                <th>Ngày tới</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = TYPE_META[r.reminderType]
                const badge = dayBadge(r)
                return (
                  <tr key={r.id} className={r.isActive ? '' : 'inactive-row'}>
                    <td>
                      <div className="cell-primary">{r.customerName}</div>
                      {r.customerPhone && <div className="cell-secondary">{r.customerPhone}</div>}
                    </td>
                    <td>
                      <div className="cell-primary">{meta.icon} {r.title}</div>
                      <div className="cell-secondary">{r.isRecurring ? 'Hàng năm' : 'Một lần'}</div>
                    </td>
                    <td><span className="type-pill">{meta.label}</span></td>
                    <td>{r.plotCode ? `${r.plotCode}${r.zoneName ? ` · ${r.zoneName}` : ''}` : '—'}</td>
                    <td>
                      <div className="cell-primary">{formatDate(r.nextDate)}</div>
                      <span className={`day-badge ${badge.cls}`}>{badge.text}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${r.isActive ? 'on' : 'off'}`}>{r.isActive ? 'Đang bật' : 'Đã tắt'}</span>
                    </td>
                    <td>
                      <button
                        className="notify-btn"
                        disabled={!r.isActive || notifyingId === r.id}
                        onClick={() => void notifyNow(r.id)}
                        title="Gửi nhắc nhở ngay tới khách hàng"
                      >
                        {notifyingId === r.id ? 'Đang gửi...' : 'Gửi nhắc ngay'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
