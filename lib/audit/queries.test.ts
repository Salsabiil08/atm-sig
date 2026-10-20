// T-504 — Tests: tampilan audit log — FR-092
import { describe, expect, it } from 'vitest'
import { parseAuditFilters } from './queries'

describe('parseAuditFilters (FR-092)', () => {
  it('returns nulls for empty / missing params and defaults to page 1', () => {
    const filters = parseAuditFilters({})
    expect(filters).toEqual({
      action: null,
      objectPrefix: null,
      dateFrom: null,
      dateTo: null,
      page: 1,
    })
  })

  it('trims and keeps non-empty action and object prefix', () => {
    const filters = parseAuditFilters({ action: ' assign_role ', object: 'tasks' })
    expect(filters.action).toBe('assign_role')
    expect(filters.objectPrefix).toBe('tasks')
  })

  it('accepts valid date strings and converts page to an integer', () => {
    const filters = parseAuditFilters({
      from: '2026-10-01',
      to:   '2026-10-31',
      page: '3',
    })
    expect(filters.dateFrom).toBe('2026-10-01')
    expect(filters.dateTo).toBe('2026-10-31')
    expect(filters.page).toBe(3)
  })

  it('ignores invalid date strings', () => {
    const filters = parseAuditFilters({ from: 'not-a-date', to: '2026-02-30' })
    expect(filters.dateFrom).toBeNull()
    expect(filters.dateTo).toBeNull()
  })

  it('throws when dateFrom is after dateTo', () => {
    expect(() =>
      parseAuditFilters({ from: '2026-10-31', to: '2026-10-01' }),
    ).toThrow('Periode audit log tidak valid.')
  })

  it('clamps page to 1 for invalid or zero page values', () => {
    expect(parseAuditFilters({ page: '0' }).page).toBe(1)
    expect(parseAuditFilters({ page: 'abc' }).page).toBe(1)
    expect(parseAuditFilters({ page: '-5' }).page).toBe(1)
  })
})
