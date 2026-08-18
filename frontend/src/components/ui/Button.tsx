// src/components/ui/Button.tsx
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-accent-teal)',
    color: '#0A1628',
    fontWeight: 600,
  },
  secondary: {
    background: 'transparent',
    color: 'var(--color-accent-teal)',
    border: '1px solid var(--color-accent-teal)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
  },
  danger: {
    background: 'var(--color-danger)',
    color: '#fff',
  },
}

export default function Button({ variant = 'primary', loading, children, style, ...props }: ButtonProps) {
  return (
    <button
      style={{
        ...VARIANT_STYLES[variant],
        borderRadius: 'var(--radius-btn)',
        padding: '10px 20px',
        fontSize: 14,
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        border: VARIANT_STYLES[variant].border ?? 'none',
        fontFamily: 'var(--font-body)',
        ...style,
      }}
      disabled={loading || props.disabled}
      {...props}>
      {loading ? '...' : children}
    </button>
  )
}