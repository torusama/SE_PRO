import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

interface PlotDetail {
  id: number
  plotCode: string
  zoneName: string
  rowCode: string
  plotNumber: string | number
  status: 'available' | 'pending' | 'reserved' | 'sold' | 'locked'
  price: number
  area: number
  direction?: string
  plotType?: string
  description?: string
}

interface ReservationResult {
  id: number
  status: string
  totalPrice: number
}

function formatVnd(value?: number) {
  if (!value) return 'Liên hệ'
  return new Intl.NumberFormat('vi-VN').format(value) + ' ₫'
}

export default function BookingPage() {
  const { lotId } = useParams()
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  const [plot, setPlot] = useState<PlotDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [reservation, setReservation] = useState<ReservationResult | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPlot() {
      if (!lotId) return
      setLoading(true)
      setError('')
      try {
        const { data } = await api.get(`/plots/${lotId}`)
        if (!cancelled) setPlot(data.data ?? data)
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message ?? 'Không tải được thông tin lô.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPlot()
    return () => {
      cancelled = true
    }
  }, [lotId])

  async function confirmReservation() {
    if (!plot || !token) return

    setSubmitting(true)
    setError('')
    try {
      const createResponse = await api.post('/reservations', {
        type: 'reserve',
        plotIds: [plot.id],
        note: `Customer selected plot ${plot.plotCode} from 2D map`,
      })
      const created = createResponse.data.data as ReservationResult
      const submitResponse = await api.post(`/reservations/${created.id}/submit`)
      setReservation(submitResponse.data.data ?? created)
      setPlot((current) => current ? { ...current, status: 'pending' } : current)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể tạo yêu cầu giữ chỗ.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main style={styles.page}>Đang tải thông tin lô...</main>
  }

  return (
    <main style={styles.page}>
      <section style={styles.panel}>
        <button style={styles.backButton} type="button" onClick={() => navigate(ROUTES.MAP)}>
          Quay lại bản đồ
        </button>

        <p style={styles.kicker}>Đặt chỗ lô đất</p>
        <h1 style={styles.title}>{plot?.plotCode ?? lotId}</h1>

        {error && <div style={styles.error}>{error}</div>}

        {plot && (
          <>
            <div style={styles.grid}>
              <Info label="Khu" value={plot.zoneName} />
              <Info label="Hàng" value={String(plot.rowCode)} />
              <Info label="Số lô" value={String(plot.plotNumber)} />
              <Info label="Trạng thái" value={plot.status} />
              <Info label="Giá" value={formatVnd(plot.price)} />
              <Info label="Diện tích" value={`${plot.area} m²`} />
              <Info label="Hướng" value={plot.direction ?? 'Đang cập nhật'} />
              <Info label="Loại" value={plot.plotType ?? 'Tiêu chuẩn'} />
            </div>

            <div style={styles.note}>
              {plot.description ?? 'Yêu cầu giữ chỗ sẽ được lưu vào tài khoản của bạn và chờ nhân viên duyệt.'}
            </div>

            {!token && (
              <div style={styles.warning}>
                Bạn cần đăng nhập trước khi tạo yêu cầu giữ chỗ.
              </div>
            )}

            {plot.status !== 'available' && (
              <div style={styles.warning}>
                Lô này hiện không còn khả dụng để giữ chỗ.
              </div>
            )}

            {reservation && (
              <div style={styles.success}>
                Đã lưu yêu cầu giữ chỗ #{reservation.id} cho {user?.name ?? 'tài khoản của bạn'}.
              </div>
            )}

            <button
              style={{
                ...styles.primaryButton,
                opacity: !token || plot.status !== 'available' || submitting ? 0.55 : 1,
              }}
              type="button"
              disabled={!token || plot.status !== 'available' || submitting}
              onClick={confirmReservation}
            >
              {submitting ? 'Đang lưu yêu cầu...' : 'Xác nhận giữ chỗ'}
            </button>
          </>
        )}
      </section>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: 'calc(100vh - 80px)',
    padding: '48px 20px',
    background: '#04060e',
    color: '#d4e8e0',
    fontFamily: 'Be Vietnam Pro, sans-serif',
  },
  panel: {
    maxWidth: 760,
    margin: '0 auto',
    padding: 24,
    border: '1px solid rgba(0,229,196,0.16)',
    borderRadius: 8,
    background: 'rgba(8,13,26,0.76)',
  },
  backButton: {
    border: '1px solid rgba(0,229,196,0.2)',
    borderRadius: 8,
    background: 'transparent',
    color: '#7a9a90',
    padding: '9px 12px',
    cursor: 'pointer',
  },
  kicker: {
    margin: '24px 0 6px',
    color: '#c9a84c',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: {
    margin: '0 0 20px',
    fontFamily: 'Playfair Display, serif',
    fontSize: 36,
    color: '#e8f4f0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
  },
  infoItem: {
    padding: 14,
    border: '1px solid rgba(0,229,196,0.12)',
    borderRadius: 8,
    background: 'rgba(4,6,14,0.55)',
  },
  infoLabel: {
    display: 'block',
    marginBottom: 5,
    color: '#7a9a90',
    fontSize: 12,
  },
  infoValue: {
    color: '#d4e8e0',
    fontSize: 14,
  },
  note: {
    marginTop: 18,
    padding: 14,
    border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: 8,
    color: '#eadcb5',
    background: 'rgba(201,168,76,0.06)',
    lineHeight: 1.6,
  },
  warning: {
    marginTop: 14,
    padding: 12,
    border: '1px solid rgba(245,166,35,0.35)',
    borderRadius: 8,
    color: '#ffdca0',
    background: 'rgba(245,166,35,0.08)',
  },
  success: {
    marginTop: 14,
    padding: 12,
    border: '1px solid rgba(0,229,196,0.35)',
    borderRadius: 8,
    color: '#bdfdf2',
    background: 'rgba(0,229,196,0.08)',
  },
  error: {
    marginBottom: 14,
    padding: 12,
    border: '1px solid rgba(232,74,74,0.35)',
    borderRadius: 8,
    color: '#ffb3b3',
    background: 'rgba(232,74,74,0.08)',
  },
  primaryButton: {
    width: '100%',
    marginTop: 18,
    padding: 13,
    borderRadius: 8,
    border: '1px solid rgba(201,168,76,0.45)',
    background: 'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(0,229,196,0.1))',
    color: '#f0c060',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
