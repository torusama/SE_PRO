import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentRecommendation } from './agent.types'
import ComparisonPanel from './ComparisonPanel'

const option = (
  optionId: string,
  plotCode: string,
): AgentRecommendation => ({
  optionId,
  plotIds: [1],
  plotCodes: [plotCode],
  score: 0.73,
  plotCost: 19_000_000,
  serviceCost: 0,
  estimatedTotal: 19_000_000,
  currency: 'VND',
  zoneName: 'Khu D â€” BÃ¬nh dÃ¢n',
  directions: ['Nam'],
  totalAreaSqm: 3,
  isAdjacent: false,
  reasons: [],
  tradeOffs: [],
  highlightPlotIds: [1],
})

describe('ComparisonPanel', () => {
  afterEach(cleanup)

  it('keeps clean labels and encoding-safe prices inside its table', () => {
    render(
      <ComparisonPanel
        options={[
          option('OPT-001', 'D-02-001'),
          option('OPT-002', 'D-02-002'),
        ]}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Khu D - Bình dân')).toHaveLength(2)
    expect(screen.getAllByText('19.000.000 VND')).toHaveLength(2)
    expect(screen.queryByText(/â€”|¤/)).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveStyle({ minWidth: '630px' })
  })
})

