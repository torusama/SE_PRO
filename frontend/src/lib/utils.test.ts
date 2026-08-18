import { describe, expect, it } from 'vitest'
import { formatCalendarDate } from './utils'

describe('formatCalendarDate', () => {
  it('formats PostgreSQL calendar dates', () => {
    expect(formatCalendarDate('2026-08-03')).toBe('3/8/2026')
  })

  it('supports the legacy ISO response without producing Invalid Date', () => {
    expect(formatCalendarDate('2026-08-02T17:00:00.000Z')).toBe('3/8/2026')
  })

  it('returns a readable fallback for malformed values', () => {
    expect(formatCalendarDate('not-a-date')).toBe('Ngày không hợp lệ')
  })
})
