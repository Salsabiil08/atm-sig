import { describe, expect, it } from 'vitest'
import { isValidTaskReviewer, type TaskReviewerProfile } from './reviewer'

const staff: TaskReviewerProfile = {
  id: 'staff',
  roleLevel: 2,
  supervisorId: 'manager',
  active: true,
}

describe('isValidTaskReviewer (FR-040, BR-070)', () => {
  it.each([
    { ownerLevel: 2, reviewerLevel: 3 },
    { ownerLevel: 3, reviewerLevel: 4 },
    { ownerLevel: 4, reviewerLevel: 5 },
  ])('accepts direct supervisor review for role level $ownerLevel', ({ ownerLevel, reviewerLevel }) => {
    expect(isValidTaskReviewer(
      { ...staff, roleLevel: ownerLevel, supervisorId: 'supervisor' },
      { id: 'supervisor', roleLevel: reviewerLevel, supervisorId: null, active: true },
    )).toBe(true)
  })

  it('rejects missing, inactive, non-supervisor, or wrong-level reviewers', () => {
    expect(isValidTaskReviewer(staff, null)).toBe(false)
    expect(isValidTaskReviewer(staff, {
      id: 'manager',
      roleLevel: 3,
      supervisorId: null,
      active: false,
    })).toBe(false)
    expect(isValidTaskReviewer(staff, {
      id: 'other-manager',
      roleLevel: 3,
      supervisorId: null,
      active: true,
    })).toBe(false)
    expect(isValidTaskReviewer(staff, {
      id: 'manager',
      roleLevel: 4,
      supervisorId: null,
      active: true,
    })).toBe(false)
  })

  it('requires no reviewer for GM and Super Admin owners', () => {
    for (const roleLevel of [5, 6]) {
      const owner = { ...staff, roleLevel, supervisorId: null }
      expect(isValidTaskReviewer(owner, null)).toBe(true)
      expect(isValidTaskReviewer(owner, {
        id: 'unexpected',
        roleLevel: roleLevel + 1,
        supervisorId: null,
        active: true,
      })).toBe(false)
    }
  })
})
