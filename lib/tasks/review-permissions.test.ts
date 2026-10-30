import { describe, expect, it } from 'vitest'
import { canOpenTaskReview, getReviewInboxFilter } from './review-permissions'

describe('review permissions', () => {
  it('shows every pending review to Super Admin', () => {
    const actor = { id: 'super-admin', roleLevel: 6 }
    expect(getReviewInboxFilter(actor)).toBeNull()
    expect(canOpenTaskReview(actor, { ownerId: 'nata', reviewerId: 'salsa' })).toBe(true)
  })

  it('shows every pending review to GM', () => {
    const actor = { id: 'gm', roleLevel: 5 }
    expect(getReviewInboxFilter(actor)).toBeNull()
    expect(canOpenTaskReview(actor, { ownerId: 'nata', reviewerId: 'salsa' })).toBe(true)
  })

  it('keeps other roles scoped to the assigned reviewer or privileged owner', () => {
    expect(getReviewInboxFilter({ id: 'manager', roleLevel: 3 }))
      .toBe('reviewer_id.eq.manager')
    expect(canOpenTaskReview(
      { id: 'other-manager', roleLevel: 3 },
      { ownerId: 'nata', reviewerId: 'manager' },
    )).toBe(false)
  })
})
