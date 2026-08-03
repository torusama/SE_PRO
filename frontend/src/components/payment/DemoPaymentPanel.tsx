import { useEffect, useMemo, useState } from 'react'
import { getPaymentInfo, markConfirmed, markPaid, onPaymentStorageChange, type PaymentInfo } from '@/lib/paymentDemo'
import './DemoPaymentPanel.css'

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

function useCountdown(deadline: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const remainingMs = Math.max(0, new Date(deadline).getTime() - now)
  const totalSeconds = Math.floor(remainingMs / 1000)
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const ss = String(totalSeconds % 60).padStart(2, '0')
  return { label: `${mm}:${ss}`, expired: remainingMs <= 0 }
}

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

/** Mã QR GIẢ — chỉ là hình vẽ mô phỏng, không mã hoá dữ liệu thật, không quét được. */
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
    // Vẽ 3 ô "finder pattern" ở góc như QR thật cho giống mắt nhìn
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
      aria-label="Mã QR demo, không dùng để thanh toán thật"
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

interface DemoPaymentPanelProps {
  orderId: number
  amount: number
  /** 'customer': khách xem & bấm "đã thanh toán'. 'admin': admin xem & xác nhận nhận tiền. */
  variant: 'customer' | 'admin'
  /** Chỉ dùng ở variant admin — gọi khi admin bấm "Xác nhận đã nhận thanh toán". */
  onConfirmed?: () => void | Promise<void>
}

export default function DemoPaymentPanel({ orderId, amount, variant, onConfirmed }: DemoPaymentPanelProps) {
  const [info, setInfo] = useState<PaymentInfo>(() => getPaymentInfo(orderId, amount))
  const [confirming, setConfirming] = useState(false)
  const countdown = useCountdown(info.deadline)

  useEffect(() => {
    return onPaymentStorageChange(() => setInfo(getPaymentInfo(orderId, amount)))
  }, [orderId, amount])

  function handleMarkPaid() {
    setInfo(markPaid(orderId, amount))
  }

  async function handleConfirm() {
    setConfirming(true)
    try {
      setInfo(markConfirmed(orderId, amount))
      await onConfirmed?.()
    } finally {
      setConfirming(false)
    }
  }

  // ---------- ADMIN ----------
  if (variant === 'admin') {
    return (
      <section className="demo-payment demo-payment--admin">
        <h3>Thanh toán</h3>
        {!info.paid && (
          <div className="demo-payment-status demo-payment-status--waiting">
            ⏳ Đang chờ khách hàng thanh toán (mã <strong>{info.code}</strong>, hạn còn {countdown.label}).
          </div>
        )}
        {info.paid && !info.confirmed && (
          <>
            <div className="demo-payment-status demo-payment-status--paid">
              💰 Khách hàng báo đã thanh toán lúc{' '}
              {info.paidAt ? new Date(info.paidAt).toLocaleString('vi-VN') : '—'} · Mã: <strong>{info.code}</strong> ·
              Số tiền: <strong>{money.format(info.amount)}</strong>
            </div>
            <p className="demo-payment-hint">
              Kiểm tra đã nhận được tiền trong tài khoản ngân hàng thật rồi mới bấm xác nhận bên dưới.
            </p>
            <button className="service-primary" onClick={() => void handleConfirm()} disabled={confirming}>
              {confirming ? 'Đang xác nhận…' : '✅ Xác nhận đã nhận thanh toán'}
            </button>
          </>
        )}
        {info.confirmed && (
          <div className="demo-payment-status demo-payment-status--confirmed">
            ✅ Đã xác nhận thanh toán lúc {info.confirmedAt ? new Date(info.confirmedAt).toLocaleString('vi-VN') : '—'}.
          </div>
        )}
      </section>
    )
  }

  // ---------- CUSTOMER ----------
  if (info.confirmed) {
    return (
      <section className="demo-payment demo-payment--customer">
        <h3>Thanh toán</h3>
        <div className="demo-payment-status demo-payment-status--confirmed">
          ✅ Đã xác nhận thanh toán thành công. Đơn của bạn sẽ sớm được thực hiện.
        </div>
      </section>
    )
  }

  if (info.paid) {
    return (
      <section className="demo-payment demo-payment--customer">
        <h3>Thanh toán</h3>
        <div className="demo-payment-status demo-payment-status--paid">
          🕒 Đã ghi nhận bạn thanh toán lúc {info.paidAt ? new Date(info.paidAt).toLocaleString('vi-VN') : '—'}. Đang
          chờ hệ thống xác nhận, vui lòng chờ trong giây lát.
        </div>
      </section>
    )
  }

  return (
    <section className="demo-payment demo-payment--customer">
      <h3>Thanh toán</h3>
      <div className={`demo-payment-timer ${countdown.expired ? 'expired' : ''}`}>
        {countdown.expired ? 'Đã hết hạn thanh toán, vui lòng liên hệ để được hỗ trợ.' : `Thời gian còn lại: ${countdown.label}`}
      </div>

      <div className="demo-payment-body">
        <div className="demo-payment-qr">
          <FakeQrCode seed={info.code} />
          <span className="demo-payment-qr-badge">Mã QR demo — không dùng để quét thật</span>
        </div>
        <div className="demo-payment-info">
          <div className="demo-payment-row">
            <span>Ngân hàng</span>
            <strong>VPV BANK (demo)</strong>
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
            <strong>{money.format(info.amount)}</strong>
          </div>
          <div className="demo-payment-row">
            <span>Nội dung chuyển khoản</span>
            <strong>{info.code}</strong>
          </div>
        </div>
      </div>

      <p className="demo-payment-note">
        * Đây là dữ liệu demo cho mục đích trình bày đồ án, không phải cổng thanh toán thật.
      </p>
      <button className="service-primary" onClick={handleMarkPaid} disabled={countdown.expired}>
        Tôi đã thanh toán
      </button>
    </section>
  )
}