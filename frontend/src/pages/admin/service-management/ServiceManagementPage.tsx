import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import DemoPaymentPanel from '@/components/payment/DemoPaymentPanel'
import './ServiceManagementPage.css'

type OrderStatus =
  | 'submitted'
  | 'pending_confirm'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

interface Assignee {
  id: number
  name: string
}

interface OrderHistory {
  id: number
  action: string
  previousStatus?: OrderStatus | null
  newStatus?: OrderStatus | null
  note?: string | null
  createdAt: string
  changedByName?: string | null
  assignedToName?: string | null
}

interface ServiceOrder {
  id: number
  status: OrderStatus
  amount: number
  requestedDate?: string | null
  scheduledDate?: string | null
  createdAt: string
  updatedAt: string
  serviceName: string
  category: string
  plotCode?: string | null
  customerName: string
  customerEmail?: string
  customerPhone?: string | null
  note?: string | null
  adminNote?: string | null
  assignedTo?: number | null
  assignedToName?: string | null
  adminName?: string | null
  completionNote?: string | null
  completionImages?: string[] | null
  completedAt?: string | null
  history?: OrderHistory[]
}

const STATUS_META: Record<OrderStatus, { label: string; tone: string }> = {
  submitted: { label: 'Mới gửi', tone: 'amber' },
  pending_confirm: { label: 'Chờ xác nhận', tone: 'amber' },
  confirmed: { label: 'Đã xác nhận', tone: 'teal' },
  in_progress: { label: 'Đang thực hiện', tone: 'blue' },
  completed: { label: 'Hoàn thành', tone: 'green' },
  cancelled: { label: 'Đã huỷ', tone: 'red' },
}

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  submitted: ['submitted', 'pending_confirm', 'confirmed', 'cancelled'],
  pending_confirm: ['pending_confirm', 'confirmed', 'cancelled'],
  confirmed: ['confirmed', 'in_progress', 'cancelled'],
  in_progress: ['in_progress', 'cancelled'],
  completed: ['completed'],
  cancelled: ['cancelled'],
}

const STATUS_FILTERS: Array<{ value: 'all' | OrderStatus; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'submitted', label: 'Mới gửi' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'in_progress', label: 'Đang thực hiện' },
  { value: 'completed', label: 'Hoàn thành' },
  { value: 'cancelled', label: 'Đã huỷ' },
]

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

function formatDate(value?: string | null, withTime = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(new Date(value))
}

function orderCode(id: number) {
  return `DV-${String(id).padStart(5, '0')}`
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return 'Không thể thực hiện yêu cầu. Vui lòng thử lại.'
}

export default function ServiceManagementPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [selected, setSelected] = useState<ServiceOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')

  async function loadOrders(silent = false) {
    if (!silent) setLoading(true)
    setError('')
    try {
      const [ordersResponse, assigneesResponse] = await Promise.all([
        api.get<ApiResponse<{ items: ServiceOrder[] }>>('/admin/service-orders', {
          params: { page: 1, pageSize: 100 },
        }),
        api.get<ApiResponse<Assignee[]>>('/admin/service-order-assignees'),
      ])
      setOrders(ordersResponse.data.data?.items ?? [])
      setAssignees(assigneesResponse.data.data ?? [])
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Nạp dữ liệu từ API khi route admin được mở.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOrders()
  }, [])

  async function openDetail(orderId: number) {
    setDetailLoading(true)
    setError('')
    try {
      const response = await api.get<ApiResponse<ServiceOrder>>(`/admin/service-orders/${orderId}`)
      setSelected(response.data.data)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setDetailLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return orders.filter((order) => {
      const statusMatches =
        statusFilter === 'all' ||
        order.status === statusFilter ||
        (statusFilter === 'submitted' && order.status === 'pending_confirm')
      const searchMatches =
        !query ||
        orderCode(order.id).toLowerCase().includes(query) ||
        order.serviceName.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.plotCode?.toLowerCase().includes(query)
      return statusMatches && searchMatches
    })
  }, [orders, search, statusFilter])

  const stats = useMemo(() => ({
    total: orders.length,
    waiting: orders.filter((order) => ['submitted', 'pending_confirm'].includes(order.status)).length,
    processing: orders.filter((order) => ['confirmed', 'in_progress'].includes(order.status)).length,
    completed: orders.filter((order) => order.status === 'completed').length,
  }), [orders])

  async function refreshSelected(message: string) {
    if (!selected) return
    await Promise.all([loadOrders(true), openDetail(selected.id)])
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  return (
    <div className="service-admin">
      <header className="service-admin__header">
        <div>
          <p className="service-admin__eyebrow">Vận hành dịch vụ</p>
          <h1>Quản lý đơn dịch vụ</h1>
          <p>Theo dõi, phân công và lưu lại toàn bộ quá trình phục vụ khách hàng.</p>
        </div>
        <button className="service-admin__refresh" onClick={() => void loadOrders()} disabled={loading}>
          {loading ? 'Đang làm mới…' : 'Làm mới danh sách'}
        </button>
      </header>

      {notice && <div className="service-alert service-alert--success">{notice}</div>}
      {error && <div className="service-alert service-alert--error">{error}</div>}

      <section className="service-stats" aria-label="Tổng quan đơn dịch vụ">
        <Stat label="Tổng đơn" value={stats.total} tone="teal" />
        <Stat label="Chờ xác nhận" value={stats.waiting} tone="amber" />
        <Stat label="Đang xử lý" value={stats.processing} tone="blue" />
        <Stat label="Đã hoàn thành" value={stats.completed} tone="green" />
      </section>

      <section className="service-panel">
        <div className="service-toolbar">
          <label className="service-search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm mã đơn, khách hàng, dịch vụ hoặc mã lô"
            />
          </label>
          <div className="service-filters">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                className={statusFilter === filter.value ? 'active' : ''}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="service-empty">Đang tải đơn dịch vụ...</div>
        ) : filtered.length === 0 ? (
          <div className="service-empty">
            <strong>Không có đơn phù hợp</strong>
            <span>Thử thay đổi từ khoá hoặc bộ lọc trạng thái.</span>
          </div>
        ) : (
          <div className="service-table-wrap">
            <table className="service-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Dịch vụ & khách hàng</th>
                  <th>Lịch thực hiện</th>
                  <th>Người xử lý</th>
                  <th>Trạng thái</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <button className="service-code" onClick={() => void openDetail(order.id)}>
                        {orderCode(order.id)}
                      </button>
                      <small>Tạo {formatDate(order.createdAt)}</small>
                    </td>
                    <td>
                      <strong>{order.serviceName}</strong>
                      <small>{order.customerName}{order.plotCode ? ` · Lô ${order.plotCode}` : ''}</small>
                    </td>
                    <td>
                      <span>{formatDate(order.scheduledDate || order.requestedDate)}</span>
                      <small>{order.scheduledDate ? 'Lịch đã xác nhận' : 'Ngày khách yêu cầu'}</small>
                    </td>
                    <td>
                      <span>{order.assignedToName || 'Chưa phân công'}</span>
                    </td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      <button
                        className="service-row-action"
                        aria-label={`Xem ${orderCode(order.id)}`}
                        onClick={() => void openDetail(order.id)}
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(selected || detailLoading) && (
        <div className="service-drawer-layer" role="presentation" onMouseDown={() => !detailLoading && setSelected(null)}>
          <aside className="service-drawer" role="dialog" aria-modal="true" aria-label="Chi tiết đơn dịch vụ" onMouseDown={(event) => event.stopPropagation()}>
            {detailLoading && !selected ? (
              <div className="service-empty">Đang tải chi tiết...</div>
            ) : selected ? (
              <OrderDetail
                order={selected}
                assignees={assignees}
                onClose={() => setSelected(null)}
                onSaved={(message) => void refreshSelected(message)}
              />
            ) : null}
          </aside>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className={`service-stat service-stat--${tone}`}>
      <div><strong>{value}</strong><span>{label}</span></div>
    </article>
  )
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status]
  return <span className={`service-status service-status--${meta.tone}`}>{meta.label}</span>
}

function OrderDetail({
  order,
  assignees,
  onClose,
  onSaved,
}: {
  order: ServiceOrder
  assignees: Assignee[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [status, setStatus] = useState(order.status)
  const [assignedTo, setAssignedTo] = useState(order.assignedTo ? String(order.assignedTo) : '')
  const [scheduledDate, setScheduledDate] = useState(order.scheduledDate?.slice(0, 10) ?? '')
  const [adminNote, setAdminNote] = useState(order.adminNote ?? '')
  const [completionNote, setCompletionNote] = useState('')
  const [evidence, setEvidence] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true)
    setError('')
    try {
      await api.patch(`/admin/service-orders/${order.id}`, {
        status,
        ...(assignedTo ? { assignedTo: Number(assignedTo) } : {}),
        adminNote,
        ...(scheduledDate ? { scheduledDate } : {}),
      })
      onSaved('Đã cập nhật đơn dịch vụ và gửi thông báo cho khách hàng khi cần.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function complete() {
    if (evidence.length === 0) {
      setError('Vui lòng chọn ít nhất một ảnh bằng chứng hoàn thành.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const form = new FormData()
      form.append('completionNote', completionNote)
      evidence.forEach((file) => form.append('evidence', file))
      await api.post(`/admin/service-orders/${order.id}/completion`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onSaved('Dịch vụ đã được xác nhận hoàn thành và khách hàng đã nhận thông báo.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  function selectEvidence(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (files.length > 10) {
      setError('Chỉ được tải lên tối đa 10 ảnh bằng chứng.')
      return
    }
    if (files.some((file) => !allowedTypes.includes(file.type))) {
      setError('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.')
      return
    }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setError('Mỗi ảnh bằng chứng không được vượt quá 10 MB.')
      return
    }
    setError('')
    setEvidence(files)
  }

  const canComplete = order.status === 'in_progress'
  const terminal = ['completed', 'cancelled'].includes(order.status)

  return (
    <>
      <div className="service-drawer__header">
        <div>
          <span>{orderCode(order.id)}</span>
          <h2>{order.serviceName}</h2>
          <StatusBadge status={order.status} />
        </div>
        <button onClick={onClose} aria-label="Đóng chi tiết">Đóng</button>
      </div>

      <div className="service-drawer__body">
        {error && <div className="service-alert service-alert--error">{error}</div>}

        <section className="detail-card detail-customer">
          <h3>Thông tin khách hàng</h3>
          <div className="detail-grid">
            <Detail label="Họ tên" value={order.customerName} />
            <Detail label="Mã lô" value={order.plotCode || 'Không gắn lô'} />
            <Detail label="Email" value={order.customerEmail || '—'} />
            <Detail label="Số điện thoại" value={order.customerPhone || '—'} />
          </div>
        </section>

        <section className="detail-card">
          <h3>Thông tin yêu cầu</h3>
          <div className="detail-grid">
            <Detail label="Ngày gửi" value={formatDate(order.createdAt, true)} />
            <Detail label="Ngày khách yêu cầu" value={formatDate(order.requestedDate)} />
            <Detail label="Chi phí" value={money.format(order.amount)} />
            <Detail label="Ghi chú khách hàng" value={order.note || 'Không có ghi chú'} wide />
          </div>
        </section>

        {order.status === 'confirmed' && (
          <DemoPaymentPanel
            orderId={order.id}
            amount={order.amount}
            variant="admin"
            onConfirmed={async () => {
              setSaving(true)
              setError('')
              try {
                await api.patch(`/admin/service-orders/${order.id}`, { status: 'in_progress' })
                onSaved('Đã xác nhận thanh toán và chuyển đơn sang trạng thái Thực hiện.')
              } catch (requestError) {
                setError(getErrorMessage(requestError))
              } finally {
                setSaving(false)
              }
            }}
          />
        )}

        {!terminal && (
          <section className="detail-card detail-editor">
            <h3>Xử lý đơn</h3>
            <div className="detail-form-grid">
              <label>
                Trạng thái
                <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>
                  {NEXT_STATUSES[order.status].map((value) => (
                    <option key={value} value={value}>{STATUS_META[value].label}</option>
                  ))}
                </select>
              </label>
              <label>
                Người xử lý
                <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                  <option value="">Chưa phân công</option>
                  {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
                </select>
              </label>
              <label>
                Lịch thực hiện
                <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
              </label>
              <label className="wide">
                Ghi chú nội bộ
                <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} rows={3} maxLength={2000} />
              </label>
            </div>
            <button className="service-primary" onClick={() => void save()} disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu cập nhật'}
            </button>
          </section>
        )}

        {canComplete && (
          <section className="detail-card detail-completion">
            <h3>Xác nhận hoàn thành</h3>
            <label>
              Ghi chú kết quả
              <textarea value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} rows={3} maxLength={2000} placeholder="Mô tả công việc đã thực hiện..." />
            </label>
            <label className="evidence-picker">
              <span><strong>Chọn ảnh bằng chứng</strong>Tối đa 10 ảnh JPG, PNG hoặc WEBP · 10 MB/ảnh</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                multiple
                onChange={(event) => selectEvidence(event.target.files)}
              />
            </label>
            {evidence.length > 0 && <p className="file-summary">Đã chọn {evidence.length} ảnh: {evidence.map((file) => file.name).join(', ')}</p>}
            <button className="service-primary" onClick={() => void complete()} disabled={saving}>
              {saving ? 'Đang xác nhận…' : 'Xác nhận dịch vụ hoàn thành'}
            </button>
          </section>
        )}

        {order.status === 'completed' && (
          <section className="detail-card">
            <h3>Kết quả hoàn thành</h3>
            <p className="completion-note">{order.completionNote || 'Không có ghi chú hoàn thành.'}</p>
            <div className="evidence-grid">
              {(order.completionImages ?? []).map((filename) => (
                <EvidenceImage key={filename} orderId={order.id} filename={filename} />
              ))}
            </div>
          </section>
        )}

        <section className="detail-card">
          <h3>Lịch sử xử lý</h3>
          <div className="history-list">
            {(order.history ?? []).map((item) => (
              <article key={item.id}>
                <div className="history-dot" />
                <div>
                  <strong>{historyLabel(item)}</strong>
                  <span>{item.changedByName || 'Hệ thống'} · {formatDate(item.createdAt, true)}</span>
                  {item.assignedToName && <p>Người xử lý: {item.assignedToName}</p>}
                  {item.note && <p>{item.note}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? 'wide' : ''}><span>{label}</span><strong>{value}</strong></div>
}

function historyLabel(item: OrderHistory) {
  if (item.action === 'submitted') return 'Khách hàng gửi yêu cầu'
  if (item.action === 'assigned') return 'Phân công người xử lý'
  if (item.action === 'completed') return 'Xác nhận hoàn thành'
  if (item.newStatus) return `Cập nhật trạng thái: ${STATUS_META[item.newStatus]?.label ?? item.newStatus}`
  return 'Cập nhật thông tin đơn'
}

function EvidenceImage({ orderId, filename }: { orderId: number; filename: string }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl = ''
    let active = true
    void api.get(`/service-orders/${orderId}/evidence/${encodeURIComponent(filename)}`, { responseType: 'blob' })
      .then((response) => {
        if (!active) return
        objectUrl = URL.createObjectURL(response.data)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [filename, orderId])

  return failed
    ? <div className="evidence-loading">Không tải được ảnh</div>
    : url
    ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Bằng chứng hoàn thành dịch vụ" /></a>
    : <div className="evidence-loading">Đang tải ảnh…</div>
}