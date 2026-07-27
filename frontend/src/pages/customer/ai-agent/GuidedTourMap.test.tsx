import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuidedTourStep } from './guidedTour'
import GuidedTourMap from './GuidedTourMap'

const step: GuidedTourStep = {
  id: 'focused',
  type: 'plot-focus',
  recommendationIndex: 0,
  plotIds: [1, 2],
  narration: '',
  cameraMode: 'plot-group',
  durationMs: 0,
}

const mapPlots = [
  {
    id: 1,
    plotCode: 'A-02-001',
    zoneName: 'Khu A',
    status: 'available',
    price: 45_000_000,
    area: 4,
    direction: 'Nam',
  },
  {
    id: 2,
    plotCode: 'A-02-002',
    zoneName: 'Khu A',
    status: 'available',
    price: 46_000_000,
    area: 4,
    direction: 'Tây',
  },
]

describe('GuidedTourMap focused plots', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: mapPlots }),
      }),
    )
    window.requestAnimationFrame = (callback) => {
      window.setTimeout(() => callback(performance.now()), 0)
      return 1
    }
    window.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('does not render overlapping plot-code text and reports clicked plots', async () => {
    const onPlotSelect = vi.fn()
    const onFocusedPlotsChange = vi.fn()
    const { container } = render(
      <GuidedTourMap
        activeStep={step}
        reducedMotion
        onUserInteraction={vi.fn()}
        onCameraAnimatingChange={vi.fn()}
        onPlotSelect={onPlotSelect}
        onFocusedPlotsChange={onFocusedPlotsChange}
      />,
    )

    await waitFor(() =>
      expect(onFocusedPlotsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ plotCode: 'A-02-001' }),
          expect.objectContaining({ plotCode: 'A-02-002' }),
        ]),
      ),
    )

    expect(screen.queryByText('A-02-001')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Xoay trái' }),
    ).not.toBeInTheDocument()
    expect(container.querySelector('svg > g')).not.toHaveAttribute(
      'transform',
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: /A-02-002, Khu A, available/,
      }),
    )
    expect(onPlotSelect).toHaveBeenCalledWith(
      expect.objectContaining({ plotCode: 'A-02-002' }),
    )
  })
})
