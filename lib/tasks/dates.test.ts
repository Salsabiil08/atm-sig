import { describe, expect, it } from 'vitest'
import { toJakartaTimestamp } from './dates'
import { isTaskOverdue } from './deadline'

describe('Blueprint R.02 D-02: WIB due-date boundary', () => {
  it('preserves selected date through 23:59:59.999 WIB', () => {
    expect(toJakartaTimestamp('2026-10-21', true)).toBe('2026-10-21T16:59:59.999Z')
    expect(toJakartaTimestamp('2026-10-21')).toBe('2026-10-20T17:00:00.000Z')
  })
  it('does not flag incomplete tasks overdue before the final millisecond', () => {
    const due = toJakartaTimestamp('2026-10-21', true)
    expect(isTaskOverdue(due, 'To do', new Date('2026-10-21T16:59:59.998Z'))).toBe(false)
    expect(isTaskOverdue(due, 'To do', new Date('2026-10-21T17:00:00.000Z'))).toBe(true)
    expect(isTaskOverdue(due, 'Done', new Date('2026-10-23T00:00:00Z'))).toBe(false)
  })
  it('handles month-end and invalid dates', () => {
    expect(toJakartaTimestamp('2026-12-31', true)).toBe('2026-12-31T16:59:59.999Z')
    expect(() => toJakartaTimestamp('2026-02-30', true)).toThrow()
    expect(() => toJakartaTimestamp('bad')).toThrow()
  })
})
