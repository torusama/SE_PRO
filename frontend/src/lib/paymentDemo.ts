// ==========================================================================
// DEMO THANH TOÁN (KHÔNG PHẢI THẬT)
// --------------------------------------------------------------------------
// Vì backend chưa có bước "chờ thanh toán" nên toàn bộ trạng thái thanh toán
// ở đây chỉ được lưu tạm trong localStorage của trình duyệt, KHÔNG gửi lên
// server. Chỉ dùng cho mục đích demo / trình bày đồ án.
//
// Nếu sau này bạn muốn làm thật, chỉ cần thay các hàm bên dưới bằng các lệnh
// gọi API tương ứng (ví dụ GET/POST /service-orders/:id/payment) và giữ
// nguyên phần giao diện (DemoPaymentPanel).
// ==========================================================================

export interface PaymentInfo {
  code: string
  amount: number
  deadline: string // ISO string
  paid: boolean
  paidAt?: string
  confirmed: boolean
  confirmedAt?: string
}

const KEY_PREFIX = 'demo_payment_order_'
const DEFAULT_MINUTES = 30

function storageKey(orderId: number) {
  return `${KEY_PREFIX}${orderId}`
}

function randomCode(orderId: number) {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `VPV${String(orderId).padStart(5, '0')}${rand}`
}

function read(orderId: number): PaymentInfo | null {
  try {
    const raw = localStorage.getItem(storageKey(orderId))
    return raw ? (JSON.parse(raw) as PaymentInfo) : null
  } catch {
    return null
  }
}

function write(orderId: number, info: PaymentInfo) {
  localStorage.setItem(storageKey(orderId), JSON.stringify(info))
  return info
}

/** Lấy thông tin thanh toán demo, tự khởi tạo lần đầu (mã + hạn thanh toán). */
export function getPaymentInfo(orderId: number, amount: number): PaymentInfo {
  const existing = read(orderId)
  if (existing) return existing
  return write(orderId, {
    code: randomCode(orderId),
    amount,
    deadline: new Date(Date.now() + DEFAULT_MINUTES * 60 * 1000).toISOString(),
    paid: false,
    confirmed: false,
  })
}

/** Khách hàng bấm "Tôi đã thanh toán". */
export function markPaid(orderId: number, amount: number): PaymentInfo {
  const info = getPaymentInfo(orderId, amount)
  return write(orderId, { ...info, paid: true, paidAt: new Date().toISOString() })
}

/** Admin bấm "Xác nhận đã nhận thanh toán". */
export function markConfirmed(orderId: number, amount: number): PaymentInfo {
  const info = getPaymentInfo(orderId, amount)
  return write(orderId, { ...info, confirmed: true, confirmedAt: new Date().toISOString() })
}

/** Xoá dữ liệu demo (dùng khi muốn test lại từ đầu). */
export function clearPayment(orderId: number) {
  localStorage.removeItem(storageKey(orderId))
}

/** Lắng nghe thay đổi từ tab khác (vd: khách thanh toán ở tab kia, admin đang mở tab này). */
export function onPaymentStorageChange(callback: () => void) {
  const handler = (event: StorageEvent) => {
    if (event.key && event.key.startsWith(KEY_PREFIX)) callback()
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}