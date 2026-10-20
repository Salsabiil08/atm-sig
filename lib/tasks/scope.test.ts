import { describe, expect, it } from 'vitest'
import { getVisibleTaskOrgUnitIds } from './scope'
import type { SessionUser } from '@/lib/auth/session'

const orgUnits = [
  { id: 1, parent_id: null },
  { id: 2, parent_id: 1 },
  { id: 3, parent_id: 1 },
  { id: 4, parent_id: 2 },
  { id: 5, parent_id: 2 },
  { id: 6, parent_id: 3 },
]

function session(roleLevel: number, orgUnitId: number): SessionUser {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'user@example.test', name: 'User', role: 'Spectator', roleLevel,
    orgUnitId, supervisorId: null,
  }
}

describe('task filter option organization scope (FR-029, FR-110, FR-111)', () => {
  it('limits a Manager and PIC to their section', () => {
    expect(getVisibleTaskOrgUnitIds(session(3, 4), orgUnits)).toEqual([4])
    expect(getVisibleTaskOrgUnitIds(session(2, 4), orgUnits)).toEqual([4])
  })

  it('limits an SM to the unit and its sections', () => {
    expect(getVisibleTaskOrgUnitIds(session(4, 2), orgUnits)).toEqual([2, 4, 5])
  })

  it('limits a Spectator to the assigned organization tree', () => {
    expect(getVisibleTaskOrgUnitIds(session(1, 2), orgUnits)).toEqual([2, 4, 5])
  })

  it('allows GM and Super Admin across all organization units', () => {
    expect(getVisibleTaskOrgUnitIds(session(5, 1), orgUnits)).toEqual([1, 2, 3, 4, 5, 6])
    expect(getVisibleTaskOrgUnitIds(session(6, 1), orgUnits)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
