import { useMemo, useState } from 'react'
import { api } from '@/lib/api'
import './DemoPaymentPanel.css'

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

// PRNG đơn giản (mulberry32) để "mã QR" luôn giống nhau với cùng 1 mã giao dịch,
// thay vì random lại mỗi lần render.
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0
  return hash
}

/** Mã QR minh hoạ — chỉ là hình vẽ mô phỏng, không mã hoá dữ liệu thật, không quét được. */
function FakeQrCode({ seed }: { seed: string }) {
  const grid = 21
  const cell = 8
  const size = grid * cell
  const rand = useMemo(() => mulberry32(hashString(seed)), [seed])

  const modules = useMemo(() => {
    const cells: boolean[][] = Array.from({ length: grid }, () => Array(grid).fill(false))
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        cells[y][x] = rand() > 0.55
      }
    }
    const drawFinder = (ox: number, oy: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const border = x === 0 || x === 6 || y === 0 || y === 6
          const core = x >= 2 && x <= 4 && y >= 2 && y <= 4
          cells[oy + y][ox + x] = border || core
        }
      }
    }
    drawFinder(0, 0)
    drawFinder(grid - 7, 0)
    drawFinder(0, grid - 7)
    return cells
  }, [rand])

  return (
    <svg
      className="fake-qr"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Mã QR minh hoạ, không dùng để quét thanh toán thật"
    >
      <rect width={size} height={size} fill="#ffffff" />
      {modules.map((row, y) =>
        row.map(
          (on, x) =>
            on && <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#0b0f1a" />
        )
      )}
    </svg>
  )
}

/** Diễn giải lỗi chi tiết ngay trên giao diện (không cần mở DevTools):
 * phân biệt rõ 3 trường hợp — không kết nối được server, server trả lỗi có
 * thông điệp cụ thể, hoặc server trả lỗi không rõ nguyên nhân (kèm mã lỗi
 * HTTP để dễ tra log backend). */
function describeError(err: unknown, action: string): string {
  const axiosErr = err as {
    message?: string
    code?: string
    response?: { status?: number; data?: { message?: string } }
  }
  if (!axiosErr?.response) {
    return `Không kết nối được tới máy chủ để ${action} (${axiosErr?.code || axiosErr?.message || 'lỗi mạng'}). Kiểm tra backend có đang chạy và địa chỉ API (VITE_API_URL) có đúng không.`
  }
  const status = axiosErr.response.status
  const backendMessage = axiosErr.response.data?.message
  if (backendMessage) return `${backendMessage} (mã lỗi ${status})`
  return `Máy chủ trả về lỗi ${status} khi ${action}. Vui lòng xem log backend để biết chi tiết.`
}

export type PaymentStatus = 'unpaid' | 'awaiting_confirmation' | 'paid'

interface DemoPaymentPanelProps {
  orderId: number
  amount: number
  paymentStatus: PaymentStatus
  paymentCode?: string | null
  paidAt?: string | null
  paymentConfirmedAt?: string | null
  /** 'customer': khách xem & bấm "đã thanh toán". 'admin': admin xem & xác nhận nhận tiền. */
  variant: 'customer' | 'admin'
  /** Gọi lại khi thao tác thành công (thanh toán / xác nhận) để cha tải lại dữ liệu đơn. */
  onChanged?: () => void | Promise<void>
}

export default function DemoPaymentPanel({
  orderId,
  amount,
  paymentStatus,
  paymentCode,
  paidAt,
  paymentConfirmedAt,
  variant,
  onChanged,
}: DemoPaymentPanelProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const code = paymentCode || `VPV${String(orderId).padStart(5, '0')}`

  async function handleMarkPaid() {
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/service-orders/${orderId}/pay`)
    } catch (err) {
      setError(describeError(err, 'ghi nhận thanh toán'))
      setSubmitting(false)
      return
    }
    try {
      // Thanh toán đã ghi nhận thành công ở backend. Nếu bước tải lại dữ
      // liệu mới nhất này lỗi thì KHÔNG báo "thanh toán thất bại" (gây hiểu
      // lầm) — chỉ log để debug, giao diện sẽ tự đúng khi người dùng tải
      // lại trang.
      await onChanged?.()
    } catch (err) {
      console.error('Thanh toán đã ghi nhận nhưng tải lại dữ liệu thất bại:', err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirm() {
    setSubmitting(true)
    setError('')
    try {
      await api.post(`/admin/service-orders/${orderId}/confirm-payment`)
    } catch (err) {
      setError(describeError(err, 'xác nhận thanh toán'))
      setSubmitting(false)
      return
    }
    try {
      await onChanged?.()
    } catch (err) {
      console.error('Xác nhận thanh toán thành công nhưng tải lại dữ liệu thất bại:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- ADMIN ----------
  if (variant === 'admin') {
    return (
      <section className="demo-payment demo-payment--admin">
        <h3>Thanh toán</h3>
        {error && <div className="demo-payment-status demo-payment-status--waiting">{error}</div>}
        {paymentStatus === 'unpaid' && (
          <div className="demo-payment-status demo-payment-status--waiting">
            ⏳ Đang chờ khách hàng thanh toán (mã <strong>{code}</strong>).
          </div>
        )}
        {paymentStatus === 'awaiting_confirmation' && (
          <>
            <div className="demo-payment-status demo-payment-status--paid">
              💰 Khách hàng báo đã thanh toán lúc{' '}
              {paidAt ? new Date(paidAt).toLocaleString('vi-VN') : '—'} · Mã: <strong>{code}</strong> ·
              Số tiền: <strong>{money.format(amount)}</strong>
            </div>
            <p className="demo-payment-hint">
              Kiểm tra đã nhận được tiền trong tài khoản ngân hàng thật rồi mới bấm xác nhận bên dưới. Sau khi
              xác nhận, đơn sẽ tự chuyển sang trạng thái <strong>Đã thanh toán - đang thực hiện</strong>.
            </p>
            <button className="service-primary" onClick={() => void handleConfirm()} disabled={submitting}>
              {submitting ? 'Đang xác nhận…' : '✅ Xác nhận đã nhận thanh toán'}
            </button>
          </>
        )}
        {paymentStatus === 'paid' && (
          <div className="demo-payment-status demo-payment-status--confirmed">
            ✅ Đã xác nhận thanh toán lúc{' '}
            {paymentConfirmedAt ? new Date(paymentConfirmedAt).toLocaleString('vi-VN') : '—'}.
          </div>
        )}
      </section>
    )
  }

  // ---------- CUSTOMER ----------
  if (paymentStatus === 'paid') {
    return (
      <section className="demo-payment demo-payment--customer">
        <h3>Thanh toán</h3>
        <div className="demo-payment-status demo-payment-status--confirmed">
          ✅ Đã thanh toán - đang thực hiện. Đơn của bạn đang được thực hiện.
        </div>
      </section>
    )
  }

  if (paymentStatus === 'awaiting_confirmation') {
    return (
      <section className="demo-payment demo-payment--customer">
        <h3>Thanh toán</h3>
        <div className="demo-payment-status demo-payment-status--paid">
          🕒 Đã thanh toán - đang chờ duyệt. Ban quản lý sẽ xác nhận trong thời gian sớm nhất.
        </div>
      </section>
    )
  }

  return (
    <section className="demo-payment demo-payment--customer">
      <h3>Thanh toán</h3>
      {error && <div className="demo-payment-status demo-payment-status--waiting">{error}</div>}

      <div className="demo-payment-body">
        <div className="demo-payment-qr">
          <FakeQrCode seed={code} />
          <span className="demo-payment-qr-badge">Mã QR minh hoạ</span>
        </div>
        <div className="demo-payment-info">
          <div className="demo-payment-row">
            <span>Ngân hàng</span>
            <strong>VPV BANK</strong>
          </div>
          <div className="demo-payment-row">
            <span>Số tài khoản</span>
            <strong>0000 1234 5678</strong>
          </div>
          <div className="demo-payment-row">
            <span>Chủ tài khoản</span>
            <strong>VINH PHUC VIEN</strong>
          </div>
          <div className="demo-payment-row">
            <span>Số tiền</span>
            <strong>{money.format(amount)}</strong>
          </div>
          <div className="demo-payment-row">
            <span>Nội dung chuyển khoản</span>
            <strong>{code}</strong>
          </div>
        </div>
      </div>

      <button className="service-primary" onClick={() => void handleMarkPaid()} disabled={submitting}>
        {submitting ? 'Đang ghi nhận…' : 'Tôi đã thanh toán'}
      </button>
    </section>
  )
}
