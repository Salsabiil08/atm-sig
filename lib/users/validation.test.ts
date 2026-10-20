import { describe, expect, it } from 'vitest'
import {
  validateCreateUserInviteInput,
  validateAssignUserRoleInput,
  validateDecideUserRoleChangeInput,
  validateUpdateUserNameInput,
  validateUpdateUserStatusInput,
} from './validation'

describe('user management input validation (FR-005)', () => {
  it('normalizes invited user name and email', () => {
    expect(validateCreateUserInviteInput({
      name: '  Test User ',
      email: '  PERSON@example.test ',
    })).toEqual({
      name: 'Test User',
      email: 'person@example.test',
    })
  })

  it('rejects malformed invitation input and invalid email addresses', () => {
    expect(validateCreateUserInviteInput(null)).toBeNull()
    expect(validateCreateUserInviteInput({ name: ' ', email: 'person@example.test' })).toBeNull()
    expect(validateCreateUserInviteInput({ name: 'Test', email: 'not-an-email' })).toBeNull()
  })

  it('validates the target id and name before editing a profile', () => {
    expect(validateUpdateUserNameInput({
      userId: 'not-a-uuid',
      name: 'Updated User',
    })).toBeNull()
    expect(validateUpdateUserNameInput({
      userId: 'd9428888-122b-4a1b-8c34-6a00c8a0f00a',
      name: ' Updated User ',
    })).toEqual({
      userId: 'd9428888-122b-4a1b-8c34-6a00c8a0f00a',
      name: 'Updated User',
    })
  })

  it('accepts only the two supported account statuses', () => {
    expect(validateUpdateUserStatusInput({
      userId: 'd9428888-122b-4a1b-8c34-6a00c8a0f00a',
      status: 'nonaktif',
    })).toEqual({
      userId: 'd9428888-122b-4a1b-8c34-6a00c8a0f00a',
      status: 'nonaktif',
    })
    expect(validateUpdateUserStatusInput({
      userId: 'd9428888-122b-4a1b-8c34-6a00c8a0f00a',
      status: 'pending',
    })).toBeNull()
  })

  it('validates assignment IDs, one role, and an optional supervisor', () => {
    expect(validateAssignUserRoleInput({
      userId: 'd9428888-122b-4a1b-8c34-6a00c8a0f00a',
      roleId: 2,
      orgUnitId: 4,
      supervisorId: null,
    })).toEqual({
      userId: 'd9428888-122b-4a1b-8c34-6a00c8a0f00a',
      roleId: 2,
      orgUnitId: 4,
      supervisorId: null,
    })
    expect(validateAssignUserRoleInput({
      userId: 'd9428888-122b-4a1b-8c34-6a00c8a0f00a',
      roleId: 0,
      orgUnitId: 4,
      supervisorId: null,
    })).toBeNull()
  })

  it('validates Super Admin role-change decisions', () => {
    const requestId = 'd9428888-122b-4a1b-8c34-6a00c8a0f00a'
    expect(validateDecideUserRoleChangeInput({ requestId, decision: 'approved' })).toEqual({
      requestId,
      decision: 'approved',
    })
    expect(validateDecideUserRoleChangeInput({ requestId: 'invalid', decision: 'approved' })).toBeNull()
    expect(validateDecideUserRoleChangeInput({ requestId, decision: 'pending' })).toBeNull()
  })
})
