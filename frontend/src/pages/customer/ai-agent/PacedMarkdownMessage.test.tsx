import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PacedMarkdownMessage from './PacedMarkdownMessage'

describe('PacedMarkdownMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('reveals a fresh assistant response progressively and completes once', () => {
    const onComplete = vi.fn()
    const content = 'Mình đã chọn một phương án phù hợp để gia đình cùng xem.'
    const { container } = render(
      <PacedMarkdownMessage
        content={content}
        animate
        onComplete={onComplete}
      />,
    )

    expect(container).not.toHaveTextContent(content)

    act(() => {
      vi.advanceTimersByTime(160)
    })
    expect(container.textContent?.length).toBeGreaterThan(0)
    expect(container).not.toHaveTextContent(content)

    act(() => {
      vi.runAllTimers()
    })
    expect(container).toHaveTextContent(content)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
