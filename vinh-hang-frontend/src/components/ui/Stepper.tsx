// src/components/ui/Stepper.tsx
// Dùng trong customer flow: Chọn lô → Giữ chỗ & Đặt cọc → Thanh toán → Xác nhận hợp đồng
const STEPS = ['Chọn lô', 'Giữ chỗ & Đặt cọc', 'Thanh toán', 'Xác nhận hợp đồng']

interface StepperProps { currentStep: 1 | 2 | 3 | 4 }

export default function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => {
        const step = i + 1
        const done   = step < currentStep
        const active = step === currentStep
        return (
          <div key={step} className="flex items-center gap-2">
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: done || active ? 'var(--color-accent-teal)' : 'transparent',
              border: done || active ? 'none' : '1px solid var(--color-border)',
              color: done || active ? '#0A1628' : 'var(--color-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
            }}>
              {done ? '✓' : step}
            </div>
            <span style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontSize: 13 }}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div style={{ width: 32, height: 1, background: done ? 'var(--color-accent-teal)' : 'var(--color-border)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}