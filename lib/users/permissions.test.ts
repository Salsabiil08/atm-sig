import { describe, expect, it } from 'vitest'
import { ROLES } from '@/lib/constants/rbac'
import type { SessionUser } from '@/lib/auth/session'
import { canManageUser, canManageUsers, manageableOrgUnitIds } from './permissions'

const sm: SessionUser = {
  id: 'sm-id',
  email: 'sm@example.test',
  name: 'Unit SM',
  role: ROLES.SM,
  roleLevel: 4,
  orgUnitId: 2,
  supervisorId: null,
}

describe('user management permissions (FR-005)', () => {
  it('allows only SM, GM, and Super Admin to open user management', () => {
    expect(canManageUsers(sm)).toBe(true)
    expect(canManageUsers({ role: ROLES.GM })).toBe(true)
    expect(canManageUsers({ role: ROLES.SUPER_ADMIN })).toBe(true)
    expect(canManageUsers({ role: ROLES.MANAGER })).toBe(false)
    expect(canManageUsers({ role: ROLES.SPECTATOR })).toBe(false)
  })

  it('limits SM management to its unit and direct sections', () => {
    const ids = manageableOrgUnitIds(sm, [
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 1 },
      { id: 4, parentId: 2 },
      { id: 5, parentId: 3 },
    ])

    expect(ids).toEqual([2, 4])
    expect(canManageUser(sm, {
      id: 'staff-id',
      role: ROLES.STAFF_PIC,
      orgUnitId: 4,
    }, ids)).toBe(true)
    expect(canManageUser(sm, {
      id: 'other-staff-id',
      role: ROLES.STAFF_PIC,
      orgUnitId: 5,
    }, ids)).toBe(false)
  })

  it('prevents self-management and prevents GM/SM from deactivating Super Admins', () => {
    const ids = [2, 4]
    expect(canManageUser(sm, {
      id: sm.id,
      role: ROLES.SM,
      orgUnitId: 2,
    }, ids)).toBe(false)
    expect(canManageUser(sm, {
      id: 'admin-id',
      role: ROLES.SUPER_ADMIN,
      orgUnitId: 1,
    }, ids)).toBe(false)
  })
})
