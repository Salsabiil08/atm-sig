import { describe, expect, it } from 'vitest'
import { isAllowedTaskStatusTransition } from './status'

describe('BR-001 task status transitions', () => {
  const staffOwner = { isOwner: true, isReviewer: false, ownerRoleLevel: 2 }

  it.each([
    ['To do', 'In progress'],
    ['In progress', 'Blocked'],
    ['Blocked', 'In progress'],
    ['In progress', 'Review'],
    ['Revisi', 'In progress'],
  ] as const)('allows PIC transition %s -> %s', (current, next) => {
    expect(isAllowedTaskStatusTransition(current, next, staffOwner)).toBe(true)
  })

  it.each([
    ['To do', 'Done'],
    ['To do', 'Review'],
    ['Blocked', 'Done'],
    ['Review', 'In progress'],
    ['Done', 'In progress'],
  ] as const)('rejects illegal PIC transition %s -> %s', (current, next) => {
    expect(isAllowedTaskStatusTransition(current, next, staffOwner)).toBe(false)
  })

  it('allows only the assigned reviewer to approve or reject a task in Review', () => {
    const reviewer = { isOwner: false, isReviewer: true, ownerRoleLevel: 2 }
    expect(isAllowedTaskStatusTransition('Review', 'Done', reviewer)).toBe(true)
    expect(isAllowedTaskStatusTransition('Review', 'Revisi', reviewer)).toBe(true)
    expect(isAllowedTaskStatusTransition('In progress', 'Done', reviewer)).toBe(false)
    expect(isAllowedTaskStatusTransition('Review', 'Done', { ...reviewer, isReviewer: false })).toBe(false)
  })

  it('allows a GM or Super Admin task owner to finish their own task', () => {
    expect(isAllowedTaskStatusTransition('In progress', 'Done', {
      isOwner: true,
      isReviewer: false,
      ownerRoleLevel: 5,
    })).toBe(true)
    expect(isAllowedTaskStatusTransition('Review', 'Done', {
      isOwner: true,
      isReviewer: false,
      ownerRoleLevel: 6,
    })).toBe(true)
    expect(isAllowedTaskStatusTransition('In progress', 'Done', staffOwner)).toBe(false)
  })

  it('allows a GM or Super Admin owner to self-review a task without a reviewer', () => {
    const privilegedOwner = { isOwner: true, isReviewer: false, ownerRoleLevel: 5 }
    expect(isAllowedTaskStatusTransition('Review', 'Revisi', privilegedOwner)).toBe(true)
    expect(isAllowedTaskStatusTransition('Review', 'Done', privilegedOwner)).toBe(true)
    expect(isAllowedTaskStatusTransition('In progress', 'Revisi', privilegedOwner)).toBe(false)
  })

  it('allows a scoped manager the ordinary state transitions but keeps review decisions assigned', () => {
    const manager = { isOwner: false, isReviewer: false, canManageTask: true, ownerRoleLevel: 4 }
    expect(isAllowedTaskStatusTransition('To do', 'In progress', manager)).toBe(true)
    expect(isAllowedTaskStatusTransition('In progress', 'Blocked', manager)).toBe(true)
    expect(isAllowedTaskStatusTransition('In progress', 'Review', manager)).toBe(true)
    expect(isAllowedTaskStatusTransition('Revisi', 'In progress', manager)).toBe(true)
    expect(isAllowedTaskStatusTransition('Review', 'Done', manager)).toBe(false)
    expect(isAllowedTaskStatusTransition('Review', 'Revisi', manager)).toBe(false)
  })
})
