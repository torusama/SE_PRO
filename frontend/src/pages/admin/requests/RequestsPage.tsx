import { useEffect, useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import { api } from '@/lib/api'

type ReservationType = 'reserve' | 'purchase'
type ReservationStatus = 'pending' | 'submitted' | 'approved' | 'rejected' | 'cancelled' | 'draft'

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

interface ReservationSummary {
  id: number
  type: ReservationType
  status: ReservationStatus
  customerName?: string
  customerEmail?: string
  totalPrice?: number
  plotCodes?: string[]
  plotCount?: number
  createdAt?: string
  reviewedAt?: string | null
}

interface ReservationPlot {
  id: number
  code: string
  status: string
  price: number
}

interface ReservationDetail extends ReservationSummary {
  note?: string | null
  adminNote?: string | null
  customerPhone?: string | null
  adminName?: string | null
  plots?: ReservationPlot[]
}

type DecisionAction = 'approve' | 'reject'

const statusMeta: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Chờ duyệt', color: '#F5A623', bg: 'rgba(245,166,35,0.16)' },
  submitted: { label: 'Chờ duyệt', color: '#F5A623', bg: 'rgba(245,166,35,0.16)' },
  approved: { label: 'Đã duyệt', color: '#00C8A0', bg: 'rgba(0,200,160,0.14)' },
  rejected: { label: 'Đã từ chối', color: '#FF5C5C', bg: 'rgba(255,92,92,0.14)' },
  cancelled: { label: 'Đã hủy', color: '#8DA5C0', bg: 'rgba(141,165,192,0.14)' },
  draft: { label: 'Nháp', color: '#8DA5C0', bg: 'rgba(141,165,192,0.14)' },
}

const typeLabel: Record<ReservationType, string> = {
  reserve: 'Giữ chỗ',
  purchase: 'Mua lô',
}

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const pageStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(360px, 1fr) minmax(420px, 0.9fr)',
  gap: 18,
  minHeight: '100%',
}

const panelStyle: React.CSSProperties = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
}

const labelStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return 'Không thể xử lý yêu cầu. Vui lòng thử lại.'
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function StatusPill({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, color: '#8DA5C0', bg: 'rgba(141,165,192,0.14)' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 24,
        padding: '3px 10px',
        borderRadius: 999,
        background: meta.bg,
        color: meta.color,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}>
      {meta.label}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <span style={labelStyle}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<ReservationSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ReservationDetail | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [decisionLoading, setDecisionLoading] = useState<DecisionAction | null>(null)

  const selectedSummary = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId],
  )

  const current = detail ?? selectedSummary
  const canDecide = current ? ['pending', 'submitted'].includes(current.status) : false

  async function loadRequests(nextSelectedId?: number) {
    setLoadingList(true)
    setError('')
    try {
      const response = await api.get<ApiResponse<ReservationSummary[]>>('/admin/reservations')
      const rows = response.data.data ?? []
      setRequests(rows)
      const nextId = nextSelectedId ?? selectedId ?? rows[0]?.id ?? null
      setSelectedId(nextId)
      return nextId
    } catch (err) {
      setError(getErrorMessage(err))
      return null
    } finally {
      setLoadingList(false)
    }
  }

  async function loadDetail(id: number) {
    setLoadingDetail(true)
    setError('')
    try {
      const response = await api.get<ApiResponse<ReservationDetail>>(`/admin/reservations/${id}`)
      setDetail(response.data.data)
      setAdminNote(response.data.data.adminNote ?? '')
    } catch (err) {
      setError(getErrorMessage(err))
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  async function decide(action: DecisionAction) {
    if (!current || !canDecide) return
    const isReject = action === 'reject'
    const ok = window.confirm(
      isReject
        ? `Từ chối yêu cầu #${current.id}? Lô pending sẽ được mở lại nếu không còn yêu cầu hợp lệ khác.`
        : `Duyệt yêu cầu #${current.id}? Lô sẽ chuyển sang ${current.type === 'purchase' ? 'đã bán' : 'đã giữ chỗ'}.`,
    )
    if (!ok) return

    setDecisionLoading(action)
    setError('')
    setSuccessMessage('')
    try {
      await api.patch(`/admin/reservations/${current.id}/${action}`, {
        adminNote: adminNote.trim() || undefined,
      })
      setSuccessMessage(isReject ? `Đã từ chối yêu cầu #${current.id}.` : `Đã duyệt yêu cầu #${current.id}.`)
      const nextId = await loadRequests(current.id)
      if (nextId) await loadDetail(nextId)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDecisionLoading(null)
    }
  }

  useEffect(() => {
    void loadRequests()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    void loadDetail(selectedId)
  }, [selectedId])

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, color: 'var(--color-text-primary)' }}>Xử lý yêu cầu</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            Duyệt hoặc từ chối các yêu cầu giữ chỗ và mua lô đang chờ xử lý.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void loadRequests(selectedId ?? undefined)} loading={loadingList}>
          Làm mới
        </Button>
      </header>

      {error ? (
        <div style={{ ...panelStyle, padding: 14, borderColor: 'rgba(255,92,92,0.45)', color: '#FFB3B3' }}>
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div style={{ ...panelStyle, padding: 14, borderColor: 'rgba(0,200,160,0.45)', color: '#B8FFF0' }}>
          {successMessage}
        </div>
      ) : null}

      <section style={pageStyle}>
        <div style={{ ...panelStyle, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 18px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Danh sách yêu cầu</h2>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{requests.length} yêu cầu</span>
          </div>

          {loadingList ? (
            <div style={{ padding: 18, color: 'var(--color-text-secondary)' }}>Đang tải yêu cầu...</div>
          ) : requests.length === 0 ? (
            <div style={{ padding: 18, color: 'var(--color-text-secondary)' }}>Chưa có yêu cầu nào.</div>
          ) : (
            <div style={{ display: 'grid' }}>
              {requests.map((request) => {
                const active = request.id === selectedId
                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedId(request.id)}
                    style={{
                      display: 'grid',
                      gap: 10,
                      textAlign: 'left',
                      padding: 16,
                      border: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      borderLeft: active ? '3px solid var(--color-accent-teal)' : '3px solid transparent',
                      background: active ? 'rgba(0,200,160,0.08)' : 'transparent',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <strong>#{request.id} - {typeLabel[request.type]}</strong>
                      <StatusPill status={request.status} />
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                      {request.customerName || request.customerEmail || 'Khách hàng'}
                    </div>
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                      {(request.plotCodes ?? []).join(', ') || `${request.plotCount ?? 0} lô`} · {formatDate(request.createdAt)}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <aside style={{ ...panelStyle, padding: 18, alignSelf: 'start' }}>
          {!current ? (
            <div style={{ color: 'var(--color-text-secondary)' }}>Chọn một yêu cầu để xem chi tiết.</div>
          ) : loadingDetail ? (
            <div style={{ color: 'var(--color-text-secondary)' }}>Đang tải chi tiết...</div>
          ) : (
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 20 }}>Yêu cầu #{current.id}</h2>
                  <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)' }}>{typeLabel[current.type]}</p>
                </div>
                <StatusPill status={current.status} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <InfoRow label="Khách hàng" value={current.customerName || '-'} />
                <InfoRow label="Email" value={current.customerEmail || '-'} />
                <InfoRow label="Số điện thoại" value={detail?.customerPhone || '-'} />
                <InfoRow label="Tổng tiền" value={money.format(Number(current.totalPrice ?? 0))} />
                <InfoRow label="Ngày gửi" value={formatDate(current.createdAt)} />
                <InfoRow label="Ngày xử lý" value={formatDate(current.reviewedAt)} />
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <span style={labelStyle}>Danh sách lô</span>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(detail?.plots ?? []).length > 0 ? (
                    detail?.plots?.map((plot) => (
                      <div
                        key={plot.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '10px 12px',
                          border: '1px solid var(--color-border)',
                          borderRadius: 8,
                          background: 'rgba(255,255,255,0.03)',
                        }}>
                        <strong>{plot.code}</strong>
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                          {plot.status} · {money.format(Number(plot.price ?? 0))}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--color-text-secondary)' }}>
                      {(current.plotCodes ?? []).join(', ') || 'Không có dữ liệu lô'}
                    </div>
                  )}
                </div>
              </div>

              <InfoRow label="Ghi chú khách hàng" value={detail?.note || '-'} />

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={labelStyle}>Ghi chú admin</span>
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  rows={4}
                  disabled={!canDecide}
                  placeholder="Nhập lý do hoặc ghi chú xử lý..."
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                    padding: 12,
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                  }}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button
                  variant="danger"
                  onClick={() => void decide('reject')}
                  loading={decisionLoading === 'reject'}
                  disabled={!canDecide || decisionLoading !== null}>
                  Từ chối
                </Button>
                <Button
                  onClick={() => void decide('approve')}
                  loading={decisionLoading === 'approve'}
                  disabled={!canDecide || decisionLoading !== null}>
                  Duyệt
                </Button>
              </div>

              {!canDecide ? (
                <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                  Yêu cầu này đã được xử lý nên không thể duyệt hoặc từ chối lại.
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </section>
    </div>
  )
}
