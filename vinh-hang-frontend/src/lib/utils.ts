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

/** Ghép class names (thay thế clsx nhẹ) */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Lấy initials từ tên: "Nguyễn Thành" → "NT" */
export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}