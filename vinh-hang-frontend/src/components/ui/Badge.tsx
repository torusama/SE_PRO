// src/components/ui/Badge.tsx
type BadgeVariant = 'available' | 'reserved' | 'sold' | 'locked' | 'new' | 'pending'

const BADGE_COLORS: Record<BadgeVariant, { bg: string; color: string; label: string }> = {
  available: { bg: 'rgba(0,200,160,0.15)', color: '#00C8A0', label: 'Còn trống' },
  reserved:  { bg: 'rgba(245,166,35,0.15)', color: '#F5A623', label: 'Đang giữ chỗ' },
  sold:      { bg: 'rgba(74,158,255,0.15)', color: '#4A9EFF', label: 'Đã bán' },
  locked:    { bg: 'rgba(255,92,92,0.15)', color: '#FF5C5C', label: 'Đã khóa' },
  new:       { bg: 'rgba(0,200,160,0.2)', color: '#00C8A0', label: 'Mới' },
  pending:   { bg: 'rgba(245,166,35,0.2)', color: '#F5A623', label: 'Chờ' },
}

interface BadgeProps { variant: BadgeVariant; label?: string }

export default function Badge({ variant, label }: BadgeProps) {
  const s = BADGE_COLORS[variant]
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 600,
      fontFamily: 'var(--font-body)',
    }}>
      {label ?? s.label}
    </span>
  )
}