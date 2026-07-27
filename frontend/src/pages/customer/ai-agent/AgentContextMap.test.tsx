import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentRecommendation } from './agent.types'
import AgentContextMap from './AgentContextMap'

vi.mock('./GuidedTourMap', async () => {
  const React = await import('react')
  const plots = [
    {
      id: 1,
      plotCode: 'A-02-001',
      zoneName: 'Khu A',
      status: 'available',
      price: 45_000_000,
      area: 4,
      direction: 'Nam',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    },
    {
      id: 2,
      plotCode: 'A-02-002',
      zoneName: 'Khu A',
      status: 'available',
      price: 46_000_000,
      area: 4,
      direction: 'Tây',
      x: 10,
      y: 0,
      width: 10,
      height: 10,
    },
  ]
  return {
    default: function MockGuidedTourMap({
      onFocusedPlotsChange,
      onPlotSelect,
    }: {
      onFocusedPlotsChange?: (value: typeof plots) => void
      onPlotSelect?: (value: (typeof plots)[number]) => void
    }) {
      React.useEffect(() => {
        onFocusedPlotsChange?.(plots)
      }, [onFocusedPlotsChange])
      return (
        <button type="button" onClick={() => onPlotSelect?.(plots[1])}>
          Chọn lô thứ hai
        </button>
      )
    },
  }
})

const recommendation: AgentRecommendation = {
  optionId: 'OPT-001',
  plotIds: [1, 2],
  plotCodes: ['A-02-001', 'A-02-002'],
  score: 0.8,
  plotCost: 91_000_000,
  serviceCost: 0,
  estimatedTotal: 91_000_000,
  currency: 'VND',
  zoneName: 'Khu A',
  directions: ['Nam', 'Tây'],
  totalAreaSqm: 8,
  isAdjacent: true,
  reasons: [],
  tradeOffs: [],
  highlightPlotIds: [1, 2],
}

describe('AgentContextMap selected plot card', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  afterEach(cleanup)

  it('shows one focused plot card and updates it after a map click', async () => {
    const onClose = vi.fn()
    render(
      <AgentContextMap
        recommendations={[recommendation]}
        activeIndex={0}
        onSelect={vi.fn()}
        onClose={onClose}
        onStartRequest={vi.fn()}
        onOpenFullMap={vi.fn()}
      />,
    )

    expect(await screen.findByText('A-02-001')).toBeInTheDocument()
    expect(screen.getByText('45.000.000 VND')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Chọn lô thứ hai'))

    expect(await screen.findByText('A-02-002')).toBeInTheDocument()
    expect(screen.getByText('46.000.000 VND')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Đóng bản đồ tư vấn' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
