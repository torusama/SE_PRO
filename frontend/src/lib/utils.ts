// src/lib/utils.ts

/** Format số tiền VND: 110000000 → "110.000.000 đ" */
export function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' đ'
}

/** Format ngày: "2025-07-22" → "22/07/2025" */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('vi-VN')
}

/** Format ngày lịch từ API, hỗ trợ cả YYYY-MM-DD và chuỗi ISO cũ. */
export function formatCalendarDate(dateStr: string): string {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? `${dateStr}T00:00:00+07:00`
    : dateStr
  const d = new Date(normalized)
  return Number.isNaN(d.getTime())
    ? 'Ngày không hợp lệ'
    : d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

/** Ghép class names (thay thế clsx nhẹ) */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Lấy initials từ tên: "Nguyễn Thành" → "NT" */
export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
