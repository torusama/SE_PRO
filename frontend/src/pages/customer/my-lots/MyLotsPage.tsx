import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'

type ReservationType = 'reserve' | 'purchase'
type ReservationStatus = 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected' | 'cancelled'
type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

interface Reservation {
  id: number
  type: ReservationType
  status: ReservationStatus
  totalPrice?: number
  plotCodes?: string[]
  plotCount?: number
  createdAt?: string
  reviewedAt?: string | null
}

interface Appointment {
  id: number
  reservationRequestId: number
  scheduledAt: string
  location: string
  assignedStaffName?: string | null
  status: AppointmentStatus
  note?: string | null
  statusNote?: string | null
}

interface Contract {
  id: number
  contractCode: string
  status: string
  totalAmount: number
  paidAmount: number
  paymentStatus: string
  contractDate?: string | null
  customerName?: string
  plotCode?: string
}

const typeLabel: Record<ReservationType, string> = {
  reserve: 'Giữ chỗ',
  purchase: 'Mua lô',
}

const statusLabel: Record<string, string> = {
  draft: 'Nháp',
  pending: 'Chờ duyệt',
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
  scheduled: 'Đã hẹn',
  completed: 'Hoàn tất',
  no_show: 'Vắng mặt',
  active: 'Hiệu lực',
  signed: 'Đã ký',
  paid: 'Đã thanh toán',
  partial: 'Thanh toán một phần',
  unpaid: 'Chưa thanh toán',
}

const statusColor: Record<string, { color: string; bg: string }> = {
  draft: { color: '#8da5c0', bg: 'rgba(141,165,192,0.12)' },
  pending: { color: '#f5a623', bg: 'rgba(245,166,35,0.14)' },
  submitted: { color: '#f5a623', bg: 'rgba(245,166,35,0.14)' },
  approved: { color: '#00c8a0', bg: 'rgba(0,200,160,0.14)' },
  rejected: { color: '#ff5c5c', bg: 'rgba(255,92,92,0.14)' },
  cancelled: { color: '#8da5c0', bg: 'rgba(141,165,192,0.12)' },
  scheduled: { color: '#4da6ff', bg: 'rgba(77,166,255,0.14)' },
  completed: { color: '#00c8a0', bg: 'rgba(0,200,160,0.14)' },
}

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return 'Không tải được dữ liệu. Vui lòng thử lại.'
}

function StatusPill({ status }: { status: string }) {
  const meta = statusColor[status] ?? { color: '#8da5c0', bg: 'rgba(141,165,192,0.12)' }
  return (
    <span style={{ color: meta.color, background: meta.bg, borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
      {statusLabel[status] ?? status}
    </span>
  )
}

export default function MyLotsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const appointmentByRequest = useMemo(() => {
    return new Map(appointments.map((appointment) => [appointment.reservationRequestId, appointment]))
  }, [appointments])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [reservationRes, appointmentRes, contractRes] = await Promise.all([
        api.get<ApiResponse<Reservation[]>>('/my/reservations'),
        api.get<ApiResponse<Appointment[]>>('/my/appointments'),
        api.get<ApiResponse<Contract[]>>('/my/contracts'),
      ])
      setReservations(reservationRes.data.data ?? [])
      setAppointments(appointmentRes.data.data ?? [])
      setContracts(contractRes.data.data ?? [])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>Theo dõi giao dịch</p>
          <h1 style={styles.title}>Lô và yêu cầu của tôi</h1>
          <p style={styles.subtitle}>Theo dõi yêu cầu giữ chỗ, mua lô, lịch hẹn ký hợp đồng và sổ sở hữu.</p>
        </div>
        <button type="button" style={styles.refreshButton} onClick={() => void loadData()} disabled={loading}>
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </header>

      {error ? <div style={styles.error}>{error}</div> : null}

      <section style={styles.summaryGrid}>
        <SummaryCard label="Yêu cầu" value={reservations.length} />
        <SummaryCard label="Chờ duyệt" value={reservations.filter((item) => ['pending', 'submitted'].includes(item.status)).length} />
        <SummaryCard label="Lịch hẹn" value={appointments.filter((item) => item.status === 'scheduled').length} />
        <SummaryCard label="Hợp đồng" value={contracts.length} />
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Yêu cầu giữ chỗ / mua lô</h2>
        {loading ? (
          <div style={styles.empty}>Đang tải yêu cầu...</div>
        ) : reservations.length === 0 ? (
          <div style={styles.empty}>Bạn chưa gửi yêu cầu nào.</div>
        ) : (
          <div style={styles.list}>
            {reservations.map((request) => {
              const appointment = appointmentByRequest.get(request.id)
              return (
                <article key={request.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div>
                      <strong style={styles.cardTitle}>#{request.id} · {typeLabel[request.type]}</strong>
                      <div style={styles.muted}>{(request.plotCodes ?? []).join(', ') || `${request.plotCount ?? 0} lô`}</div>
                    </div>
                    <StatusPill status={request.status} />
                  </div>
                  <div style={styles.metaGrid}>
                    <Info label="Ngày gửi" value={formatDate(request.createdAt)} />
                    <Info label="Ngày xử lý" value={formatDate(request.reviewedAt)} />
                    <Info label="Tổng tiền" value={money.format(Number(request.totalPrice ?? 0))} />
                  </div>
                  {appointment ? (
                    <div style={styles.appointmentBox}>
                      <div style={styles.boxLabel}>Lịch hẹn ký hợp đồng</div>
                      <div style={styles.boxText}>{formatDate(appointment.scheduledAt)} · {appointment.location}</div>
                      <div style={styles.muted}>Phụ trách: {appointment.assignedStaffName || '-'}</div>
                    </div>
                  ) : request.status === 'approved' ? (
                    <div style={styles.appointmentBox}>
                      <div style={styles.boxLabel}>Bước tiếp theo</div>
                      <div style={styles.boxText}>Admin sẽ tạo lịch hẹn ký hợp đồng offline cho yêu cầu này.</div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Hợp đồng / sổ sở hữu</h2>
        {contracts.length === 0 ? (
          <div style={styles.empty}>Chưa có hợp đồng nào được ghi nhận.</div>
        ) : (
          <div style={styles.list}>
            {contracts.map((contract) => (
              <article key={contract.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <strong style={styles.cardTitle}>{contract.contractCode}</strong>
                    <div style={styles.muted}>Lô {contract.plotCode || '-'}</div>
                  </div>
                  <StatusPill status={contract.status} />
                </div>
                <div style={styles.metaGrid}>
                  <Info label="Giá trị" value={money.format(Number(contract.totalAmount ?? 0))} />
                  <Info label="Đã thanh toán" value={money.format(Number(contract.paidAmount ?? 0))} />
                  <Info label="Thanh toán" value={statusLabel[contract.paymentStatus] ?? contract.paymentStatus} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryValue}>{value}</div>
      <div style={styles.muted}>{label}</div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: 'calc(100vh - 80px)',
    padding: '42px 20px 64px',
    background: '#04060e',
    color: '#d4e8e0',
    fontFamily: 'Be Vietnam Pro, sans-serif',
  },
  header: {
    maxWidth: 1120,
    margin: '0 auto 20px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
  },
  kicker: {
    margin: 0,
    color: '#c9a84c',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: 12,
  },
  title: {
    margin: '6px 0',
    color: '#e8f4f0',
    fontFamily: 'Playfair Display, serif',
    fontSize: 34,
  },
  subtitle: {
    margin: 0,
    color: '#7a9a90',
  },
  refreshButton: {
    border: '1px solid rgba(0,229,196,0.24)',
    borderRadius: 8,
    background: 'rgba(0,229,196,0.06)',
    color: '#bdfdf2',
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  error: {
    maxWidth: 1120,
    margin: '0 auto 16px',
    padding: 12,
    border: '1px solid rgba(232,74,74,0.35)',
    borderRadius: 8,
    color: '#ffb3b3',
    background: 'rgba(232,74,74,0.08)',
  },
  summaryGrid: {
    maxWidth: 1120,
    margin: '0 auto 18px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  summaryCard: {
    border: '1px solid rgba(0,229,196,0.12)',
    borderRadius: 8,
    background: 'rgba(8,13,26,0.76)',
    padding: 16,
  },
  summaryValue: {
    color: '#f0c060',
    fontSize: 28,
    fontWeight: 800,
  },
  section: {
    maxWidth: 1120,
    margin: '0 auto 18px',
  },
  sectionTitle: {
    margin: '0 0 12px',
    color: '#e8f4f0',
    fontSize: 20,
  },
  list: {
    display: 'grid',
    gap: 12,
  },
  card: {
    border: '1px solid rgba(0,229,196,0.12)',
    borderRadius: 8,
    background: 'rgba(8,13,26,0.76)',
    padding: 16,
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardTitle: {
    display: 'block',
    color: '#e8f4f0',
    marginBottom: 4,
  },
  muted: {
    color: '#7a9a90',
    fontSize: 13,
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
    gap: 12,
    marginTop: 14,
  },
  infoLabel: {
    color: '#7a9a90',
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    color: '#d4e8e0',
    fontWeight: 700,
  },
  appointmentBox: {
    marginTop: 14,
    padding: 12,
    border: '1px solid rgba(201,168,76,0.28)',
    borderRadius: 8,
    background: 'rgba(201,168,76,0.06)',
  },
  boxLabel: {
    color: '#c9a84c',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 5,
  },
  boxText: {
    color: '#eadcb5',
    fontWeight: 700,
  },
  empty: {
    border: '1px solid rgba(0,229,196,0.12)',
    borderRadius: 8,
    background: 'rgba(8,13,26,0.76)',
    padding: 18,
    color: '#7a9a90',
  },
}
