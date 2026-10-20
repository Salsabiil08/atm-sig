import { describe, expect, it } from 'vitest'
import { isTaskOverdue } from './deadline'

describe('isTaskOverdue (FR-057, BR-036)', () => {
  const dueDate = '2026-10-20T00:00:00.000Z'

  it('marks unfinished tasks overdue at or after the absolute deadline', () => {
    expect(isTaskOverdue(dueDate, 'In progress', new Date('2026-10-19T23:59:59.999Z')))
      .toBe(false)
    expect(isTaskOverdue(dueDate, 'In progress', new Date(dueDate))).toBe(true)
    expect(isTaskOverdue(dueDate, 'Blocked', new Date('2026-10-20T00:00:00.001Z')))
      .toBe(true)
  })

  it('never marks completed tasks or invalid timestamps as overdue', () => {
    expect(isTaskOverdue(dueDate, 'Done', new Date('2026-10-21T00:00:00.000Z')))
      .toBe(false)
    expect(isTaskOverdue('not-a-date', 'In progress', new Date())).toBe(false)
    expect(isTaskOverdue(dueDate, 'In progress', new Date(Number.NaN))).toBe(false)
  })
})
