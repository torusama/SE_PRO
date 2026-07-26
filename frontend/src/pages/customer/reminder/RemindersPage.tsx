// Chuyển thể 1:1 từ mockup fr08_nhac_lich_ngay_gio.html.
// Đã bỏ thanh nav riêng của mockup (CustomerLayout đã có Navbar dùng chung).
// Bảng chọn loại nhắc lịch rút còn 2 lựa chọn thật (Hàng năm / Một lần) khớp
// với is_recurring ở backend (/my/reminders).
// Cập nhật: bổ sung lại 3 phần mockup có mà bản rút gọn trước đó bỏ:
//   1) Nút "Đặt dịch vụ" ở banner sắp đến + icon 🌸 trên từng dòng nhắc lịch,
//      điều hướng sang trang đặt dịch vụ cúng lễ cho đúng lô liên quan.
//   2) Chọn ngày theo Âm lịch (ngoài Dương lịch) cho nhắc lịch lặp lại — quy
//      đổi sang dương lịch tự động mỗi năm bằng src/lib/lunarCalendar.ts.
//   3) Kênh nhận thông báo qua Email (ngoài in-app mặc định luôn bật).
// Payload gửi lên thêm 2 field mới: `calendarType` ('solar' | 'lunar') và
// `notifyEmail` (boolean) — nếu backend /my/reminders chưa nhận 2 field này
// thì cứ bỏ qua an toàn (không phá field cũ), chỉ cần thêm cột tương ứng ở
// bảng reminders để lưu và tính nextDate theo âm lịch khi calendarType=lunar.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'
import { nextLunarOccurrence } from '@/lib/lunarCalendar'
import './RemindersPage.css'

interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

type ReminderType = 'death_anniversary' | 'memorial' | 'maintenance' | 'other'

type CalendarType = 'solar' | 'lunar'

interface Reminder {
  id: number
  title: string
  description?: string | null
  plotId?: number | null
  reminderType: ReminderType
  isRecurring: boolean
  calendarType?: CalendarType
  remindMonth?: number | null
  remindDay?: number | null
  specificDate?: string | null
  notifyDaysBefore: number
  notifyEmail?: boolean
  notifyEmails?: string[]
  isActive: boolean
  plotCode?: string | null
  deceasedName?: string | null
  nextDate: string | null
  daysUntil: number | null
}

interface Contract {
  id: number
  status: string
  plotId: number
  plotCode: string
  zoneName?: string
}

const TYPE_META: Record<ReminderType, { icon: string; label: string; dot: string }> = {
  death_anniversary: { icon: '🕯️', label: 'Ngày giỗ', dot: 'gold' },
  memorial: { icon: '🙏', label: 'Tưởng niệm', dot: 'purple' },
  maintenance: { icon: '🧹', label: 'Chăm sóc mộ', dot: 'teal' },
  other: { icon: '🔔', label: 'Khác', dot: 'dim' },
}

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return 'Không thực hiện được yêu cầu. Vui lòng thử lại.'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
}

const emptyForm = {
  title: '',
  description: '',
  plotId: null as number | null,
  reminderType: 'death_anniversary' as ReminderType,
  isRecurring: true,
  calendarType: 'solar' as CalendarType,
  remindMonth: '' as string | number,
  remindDay: '' as string | number,
  specificDate: '',
  notifyDaysBefore: 3,
  notifyEmails: [] as string[],
  notifyEmailDraft: '',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Với nhắc lịch lặp lại theo Âm lịch, backend chỉ lưu ngày/tháng âm — client
 * tự quy đổi ra ngày dương gần nhất để hiển thị đếm ngược, phòng khi backend
 * chưa hỗ trợ tính nextDate theo âm lịch. */
function effectiveNextDate(r: Reminder): { date: Date | null; iso: string | null } {
  if (r.isRecurring && r.calendarType === 'lunar' && r.remindDay && r.remindMonth) {
    const date = nextLunarOccurrence(r.remindDay, r.remindMonth)
    return { date, iso: date.toISOString().slice(0, 10) }
  }
  if (!r.nextDate) return { date: null, iso: null }
  return { date: new Date(r.nextDate), iso: r.nextDate.slice(0, 10) }
}

function daysBetween(a: Date, b: Date): number {
  const ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  return Math.round(ms / 86400000)
}

export default function RemindersPage() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = Boolean(token)

  const [reminders, setReminders] = useState<Reminder[]>([])
  const [ownedPlots, setOwnedPlots] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formOk, setFormOk] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      if (!isAuthenticated) {
        setReminders([])
        setOwnedPlots([])
        return
      }
      const [reminderRes, contractRes] = await Promise.all([
        api.get<ApiResponse<Reminder[]>>('/my/reminders'),
        api.get<ApiResponse<Contract[]>>('/my/contracts'),
      ])
      setReminders(reminderRes.data.data ?? [])
      setOwnedPlots((contractRes.data.data ?? []).filter((c) => ['active', 'completed'].includes(c.status)))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // daysUntil "hiệu lực": ưu tiên giá trị backend trả về, nhưng với nhắc lịch
  // âm lịch thì luôn tính lại phía client để chắc chắn đúng năm hiện tại.
  function effectiveDaysUntil(r: Reminder): number | null {
    if (r.isRecurring && r.calendarType === 'lunar' && r.remindDay && r.remindMonth) {
      return daysBetween(new Date(), effectiveNextDate(r).date as Date)
    }
    return r.daysUntil
  }

  const upcoming = useMemo(() => {
    const active = reminders
      .filter((r) => r.isActive)
      .map((r) => ({ r, days: effectiveDaysUntil(r) }))
      .filter((x) => x.days !== null)
    active.sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
    return active[0] ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders])

  const sortedReminders = useMemo(() => {
    return [...reminders]
      .map((r) => ({ r, days: effectiveDaysUntil(r) }))
      .sort((a, b) => {
        if (a.days === null) return 1
        if (b.days === null) return -1
        return a.days - b.days
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders])

  // Lịch tháng: ngày nào trùng nextDate của 1 nhắc lịch sẽ có chấm vàng
  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstDow = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()
    const today = new Date()
    const eventDates = new Set(
      reminders
        .filter((r) => r.isActive)
        .map((r) => effectiveNextDate(r).iso)
        .filter((iso): iso is string => Boolean(iso)),
    )

    const cells: { date: Date; otherMonth: boolean; iso: string }[] = []
    for (let i = firstDow - 1; i >= 0; i--) cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), otherMonth: true, iso: '' })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      cells.push({ date, otherMonth: false, iso: date.toISOString().slice(0, 10) })
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date
      const next = new Date(last); next.setDate(last.getDate() + 1)
      cells.push({ date: next, otherMonth: true, iso: '' })
    }
    return cells.map((c) => ({
      ...c,
      isToday: c.date.toDateString() === today.toDateString(),
      hasEvent: !c.otherMonth && eventDates.has(c.iso),
    }))
  }, [viewMonth, reminders])

  function goToLogin() {
    navigate(ROUTES.LOGIN, { state: { from: { pathname: ROUTES.REMINDERS } } })
  }

  function startCreate(prefillDate?: Date) {
    if (!isAuthenticated) return goToLogin()
    setEditingId(null)
    setFormError('')
    setFormOk('')
    setForm({
      ...emptyForm,
      specificDate: prefillDate ? prefillDate.toISOString().slice(0, 10) : '',
      isRecurring: !prefillDate,
    })
  }

  function startEdit(reminder: Reminder) {
    setEditingId(reminder.id)
    setFormError('')
    setFormOk('')
    setForm({
      title: reminder.title,
      description: reminder.description ?? '',
      plotId: reminder.plotId ?? null,
      reminderType: reminder.reminderType,
      isRecurring: reminder.isRecurring,
      calendarType: reminder.calendarType ?? 'solar',
      remindMonth: reminder.remindMonth ?? '',
      remindDay: reminder.remindDay ?? '',
      specificDate: reminder.specificDate ?? '',
      notifyDaysBefore: reminder.notifyDaysBefore,
      notifyEmails: reminder.notifyEmails ?? [],
      notifyEmailDraft: '',
    })
  }

  /** Thêm 1 email vào danh sách nhận thông báo (ô nhập + nút "+"). */
  function addNotifyEmail() {
    const raw = form.notifyEmailDraft.trim().toLowerCase()
    if (!raw) return
    if (!EMAIL_RE.test(raw)) {
      setFormError('Email không hợp lệ.')
      return
    }
    if (form.notifyEmails.includes(raw)) {
      setFormError('Email này đã được thêm, vui lòng chọn email khác.')
      return
    }
    setFormError('')
    setForm({ ...form, notifyEmails: [...form.notifyEmails, raw], notifyEmailDraft: '' })
  }

  function removeNotifyEmail(email: string) {
    setForm({ ...form, notifyEmails: form.notifyEmails.filter((e) => e !== email) })
  }

  async function submitForm() {
    if (!isAuthenticated) return goToLogin()
    if (!form.title.trim()) {
      setFormError('Vui lòng nhập tên sự kiện.')
      return
    }
    if (form.isRecurring && (!form.remindMonth || !form.remindDay)) {
      setFormError('Vui lòng chọn tháng và ngày nhắc hàng năm.')
      return
    }
    if (!form.isRecurring && !form.specificDate) {
      setFormError('Vui lòng chọn ngày cụ thể.')
      return
    }
    setSubmitting(true)
    setFormError('')
    setFormOk('')
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        plotId: form.plotId ?? undefined,
        reminderType: form.reminderType,
        isRecurring: form.isRecurring,
        calendarType: form.isRecurring ? form.calendarType : undefined,
        remindMonth: form.isRecurring ? Number(form.remindMonth) : undefined,
        remindDay: form.isRecurring ? Number(form.remindDay) : undefined,
        specificDate: form.isRecurring ? undefined : form.specificDate,
        notifyDaysBefore: Number(form.notifyDaysBefore),
        notifyEmail: form.notifyEmails.length > 0,
        notifyEmails: form.notifyEmails,
      }
      if (editingId) {
        await api.patch(`/my/reminders/${editingId}`, payload)
        setFormOk('Đã cập nhật nhắc lịch.')
      } else {
        await api.post('/my/reminders', payload)
        setFormOk('Đã tạo nhắc lịch mới.')
      }
      setForm(emptyForm)
      setEditingId(null)
      await loadAll()
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(reminder: Reminder) {
    try {
      await api.patch(`/my/reminders/${reminder.id}`, { isActive: !reminder.isActive })
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function removeReminder(id: number) {
    if (!window.confirm('Xoá nhắc lịch này?')) return
    try {
      await api.delete(`/my/reminders/${id}`)
      if (editingId === id) { setEditingId(null); setForm(emptyForm) }
      await loadAll()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  function dayBadge(reminder: Reminder, days: number | null) {
    if (days === null) return { cls: 'past', text: 'Không lặp lại' }
    if (days === 0) return { cls: 'soon', text: 'Hôm nay' }
    if (days <= reminder.notifyDaysBefore) return { cls: 'soon', text: `Còn ${days} ngày` }
    return { cls: 'far', text: `Còn ${days} ngày` }
  }

  /** Điều hướng sang trang đặt dịch vụ cúng lễ, gắn kèm lô liên quan nếu có
   * (mockup: icon 🌸 / nút "Đặt dịch vụ →"). */
  function goBookService(reminder: Reminder) {
    if (reminder.plotId) navigate(ROUTES.SERVICE_BOOK.replace(':lotId', String(reminder.plotId)))
    else navigate(ROUTES.SERVICES)
  }

  return (
    <div className="reminder-page">
      <div className="bg-canvas">
        <div className="glow-orb" style={{ width: 480, height: 480, top: '-8%', left: '-8%', background: 'radial-gradient(circle, #c9a84c, transparent 70%)' }} />
        <div className="glow-orb" style={{ width: 420, height: 420, bottom: '-10%', right: '-6%', background: 'radial-gradient(circle, #00e5c4, transparent 70%)', animationDelay: '3s' }} />
        <div className="lotus-float" style={{ top: '20%', right: '8%' }}>🪷</div>
      </div>

      <div className="breadcrumb">
        <a onClick={() => navigate(ROUTES.HOME)}>Trang chủ</a>
        <span className="sep">›</span>
        <span className="current">Nhắc lịch</span>
      </div>

      <main>
        <header className="page-header">
          <div className="page-tag">Customer Portal · Nhắc lịch</div>
          <h1 className="page-title">Nhắc Lịch Ngày Giỗ</h1>
          <p className="page-desc">
            Thiết lập nhắc lịch ngày giỗ, lễ tưởng niệm hoặc chăm sóc phần mộ định kỳ — hệ thống sẽ tự động
            gửi thông báo trước ngày quan trọng để bạn không bỏ lỡ.
          </p>
        </header>

        {!isAuthenticated && <div className="notice-banner">Đăng nhập để tạo và quản lý nhắc lịch của bạn.</div>}
        {error && <div className="error-banner">{error}</div>}

        {upcoming && (
          <div className="upcoming-banner">
            <div className="upcoming-moon">🌕</div>
            <div className="upcoming-info">
              <div className="upcoming-label">Sắp đến</div>
              <div className="upcoming-title">{upcoming.r.title}</div>
              <p className="upcoming-sub">
                {upcoming.r.plotCode ? `Lô ${upcoming.r.plotCode} · ` : ''}
                Ngày {formatDate(effectiveNextDate(upcoming.r).iso)}
                {upcoming.r.calendarType === 'lunar' && upcoming.r.remindDay && upcoming.r.remindMonth
                  ? ` · Âm lịch ${String(upcoming.r.remindDay).padStart(2, '0')}/${String(upcoming.r.remindMonth).padStart(2, '0')}`
                  : ''}
              </p>
            </div>
            <div className="upcoming-countdown">
              <div className="countdown-num">{upcoming.days}</div>
              <div className="countdown-label">ngày nữa</div>
            </div>
            <button className="upcoming-btn" onClick={() => goBookService(upcoming.r)}>Đặt dịch vụ →</button>
          </div>
        )}

        <div className="content-grid">
          <div>
            <div className="calendar-card">
              <div className="cal-header">
                <div className="cal-month">
                  {viewMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                </div>
                <div className="cal-nav">
                  <button className="cal-nav-btn" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>‹</button>
                  <button className="cal-nav-btn" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>›</button>
                </div>
              </div>
              <div className="cal-grid">
                {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
                {calendarDays.map((c, i) => (
                  <button
                    key={i}
                    className={[
                      'cal-day',
                      c.otherMonth ? 'other-month' : '',
                      c.isToday ? 'today' : '',
                      c.hasEvent ? 'has-event' : '',
                      selectedDay && c.date.toDateString() === selectedDay.toDateString() ? 'selected' : '',
                    ].join(' ').trim()}
                    onClick={() => { setSelectedDay(c.date); startCreate(c.date) }}
                  >
                    {c.date.getDate()}
                  </button>
                ))}
              </div>
            </div>

            <div className="section-label">Danh sách nhắc lịch</div>
            {loading ? (
              <div className="empty-state"><div className="empty-icon">🕯️</div><p>Đang tải nhắc lịch...</p></div>
            ) : sortedReminders.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🕯️</div><p>Bạn chưa có nhắc lịch nào. Tạo mới ở bảng bên phải.</p></div>
            ) : (
              <div className="reminder-list">
                {sortedReminders.map(({ r, days }) => {
                  const meta = TYPE_META[r.reminderType]
                  const badge = dayBadge(r, days)
                  const eff = effectiveNextDate(r)
                  return (
                    <div key={r.id} className={`reminder-item ${badge.cls === 'soon' ? 'upcoming-soon' : ''} ${r.isActive ? '' : 'inactive'}`}>
                      <div className={`r-dot ${meta.dot}`} />
                      <div className="r-body">
                        <div className="r-name">{meta.icon} {r.title}</div>
                        <div className="r-sub">
                          {meta.label}{r.plotCode ? ` · Lô ${r.plotCode}` : ''}
                          {r.isRecurring ? (r.calendarType === 'lunar' ? ' · Âm lịch, hàng năm' : ' · Hàng năm') : ' · Một lần'}
                          {r.notifyEmails && r.notifyEmails.length > 0
                            ? ` · 📧 ${r.notifyEmails.length > 1 ? `${r.notifyEmails.length} email` : r.notifyEmails[0]}`
                            : r.notifyEmail ? ' · 📧 Email' : ''}
                        </div>
                      </div>
                      <div className="r-right">
                        <div className="r-date">{formatDate(eff.iso)}</div>
                        <span className={`r-days ${badge.cls}`}>{badge.text}</span>
                      </div>
                      <div className="r-actions">
                        <button className="r-btn" title="Đặt dịch vụ" onClick={() => goBookService(r)}>🌸</button>
                        <button className="r-btn" title={r.isActive ? 'Tạm tắt' : 'Bật lại'} onClick={() => void toggleActive(r)}>{r.isActive ? '⏸' : '▶'}</button>
                        <button className="r-btn" title="Sửa" onClick={() => startEdit(r)}>✎</button>
                        <button className="r-btn danger" title="Xoá" onClick={() => void removeReminder(r.id)}>✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="add-panel">
            <div className="add-panel-title">
              {editingId ? 'Sửa nhắc lịch' : 'Thêm nhắc lịch mới'}
              {editingId && <button onClick={() => { setEditingId(null); setForm(emptyForm) }}>Huỷ sửa</button>}
            </div>

            <div className="field">
              <label>Tên sự kiện</label>
              <input placeholder="Vd: Ngày giỗ ông Nguyễn Văn A" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>

            <div className="field">
              <label>Loại sự kiện</label>
              <div className="type-grid">
                {(Object.keys(TYPE_META) as ReminderType[]).map((t) => (
                  <div key={t} className={`type-opt ${form.reminderType === t ? 'selected' : ''}`} onClick={() => setForm({ ...form, reminderType: t })}>
                    <div className="type-opt-icon">{TYPE_META[t].icon}</div>
                    <div className="type-opt-name">{TYPE_META[t].label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Tần suất</label>
              <div className="type-grid">
                <div className={`type-opt ${form.isRecurring ? 'selected' : ''}`} onClick={() => setForm({ ...form, isRecurring: true })}>
                  <div className="type-opt-icon">🔁</div>
                  <div className="type-opt-name">Hàng năm</div>
                </div>
                <div className={`type-opt ${!form.isRecurring ? 'selected' : ''}`} onClick={() => setForm({ ...form, isRecurring: false })}>
                  <div className="type-opt-icon">📅</div>
                  <div className="type-opt-name">Một lần</div>
                </div>
              </div>
            </div>

            {form.isRecurring && (
              <div className="field">
                <label>Loại lịch nhắc</label>
                <div className="type-grid">
                  <div className={`type-opt ${form.calendarType === 'solar' ? 'selected' : ''}`} onClick={() => setForm({ ...form, calendarType: 'solar' })}>
                    <div className="type-opt-icon">📅</div>
                    <div className="type-opt-name">Dương lịch</div>
                  </div>
                  <div className={`type-opt ${form.calendarType === 'lunar' ? 'selected' : ''}`} onClick={() => setForm({ ...form, calendarType: 'lunar' })}>
                    <div className="type-opt-icon">🌕</div>
                    <div className="type-opt-name">Âm lịch</div>
                  </div>
                </div>
              </div>
            )}

            {form.isRecurring ? (
              <div className="field field-row">
                <div>
                  <label>Tháng ({form.calendarType === 'lunar' ? 'âm lịch' : 'dương lịch'})</label>
                  <select value={form.remindMonth} onChange={(e) => setForm({ ...form, remindMonth: e.target.value })}>
                    <option value="">--</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>Tháng {m}</option>)}
                  </select>
                </div>
                <div>
                  <label>Ngày</label>
                  <select value={form.remindDay} onChange={(e) => setForm({ ...form, remindDay: e.target.value })}>
                    <option value="">--</option>
                    {Array.from({ length: form.calendarType === 'lunar' ? 30 : 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Ngày {d}</option>)}
                  </select>
                </div>
                {form.calendarType === 'lunar' && form.remindDay && form.remindMonth && (
                  <div className="lunar-preview">
                    → Dương lịch năm nay/sau: {formatDate(nextLunarOccurrence(Number(form.remindDay), Number(form.remindMonth)).toISOString().slice(0, 10))}
                  </div>
                )}
              </div>
            ) : (
              <div className="field">
                <label>Ngày cụ thể</label>
                <input type="date" value={form.specificDate} onChange={(e) => setForm({ ...form, specificDate: e.target.value })} />
              </div>
            )}

            {ownedPlots.length > 0 && (
              <div className="field">
                <label>Lô phần mộ liên quan (không bắt buộc)</label>
                <select value={form.plotId ?? ''} onChange={(e) => setForm({ ...form, plotId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">— Không chọn —</option>
                  {ownedPlots.map((p) => <option key={p.plotId} value={p.plotId}>{p.plotCode}{p.zoneName ? ` · ${p.zoneName}` : ''}</option>)}
                </select>
              </div>
            )}

            <div className="field">
              <label>Nhắc trước (số ngày)</label>
              <select value={form.notifyDaysBefore} onChange={(e) => setForm({ ...form, notifyDaysBefore: Number(e.target.value) })}>
                {[0, 1, 3, 5, 7, 14].map((d) => <option key={d} value={d}>{d === 0 ? 'Đúng ngày' : `${d} ngày trước`}</option>)}
              </select>
            </div>

            <div className="field" style={{ marginBottom: 4 }}>
              <label>Kênh nhận thông báo (Gmail)</label>
              <div className="notify-email-row">
                <input
                  type="email"
                  placeholder="ten@gmail.com"
                  value={form.notifyEmailDraft}
                  onChange={(e) => { setForm({ ...form, notifyEmailDraft: e.target.value }); if (formError) setFormError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNotifyEmail() } }}
                />
                <button type="button" className="notify-email-add" title="Thêm email" onClick={addNotifyEmail}>+</button>
              </div>
              {form.notifyEmails.length > 0 && (
                <div className="notify-email-list">
                  {form.notifyEmails.map((email) => (
                    <div key={email} className="notify-email-chip">
                      📧 {email}
                      <span className="notify-email-remove" onClick={() => removeNotifyEmail(email)}>✕</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="field-hint">Thêm một hoặc nhiều Gmail sẽ cùng nhận thông báo nhắc lịch qua email.</p>
            </div>

            <div className="field">
              <label>Ghi chú (không bắt buộc)</label>
              <textarea rows={2} placeholder="Ghi chú thêm..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            {formError && <div className="form-error">{formError}</div>}
            {formOk && <div className="form-success">{formOk}</div>}

            <button className="btn-add" onClick={() => void submitForm()} disabled={submitting}>
              {submitting ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : '+ Thêm nhắc lịch'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}