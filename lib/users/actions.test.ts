import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionUser, createAdminClient, createClient, revalidatePath, canManageTargetUser } =
  vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    createAdminClient: vi.fn(),
    createClient: vi.fn(),
    revalidatePath: vi.fn(),
    canManageTargetUser: vi.fn(),
  }))

vi.mock('@/lib/auth/session', () => ({ getSessionUser }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient,
  AdminConfigurationError: class AdminConfigurationError extends Error {},
}))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/users/scope', () => ({ canManageTargetUser }))
vi.mock('next/cache', () => ({ revalidatePath }))

import {
  assignUserRole,
  decideUserRoleChange,
  inviteUser,
  proposeUserRoleChange,
  updateUserStatus,
} from './actions'

const actor = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'sm@example.test',
  name: 'Unit SM',
  role: 'SM' as const,
  roleLevel: 4,
  orgUnitId: 2,
  supervisorId: null,
}

function createChain(result: unknown, updateResult: unknown = { error: null }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    update: vi.fn(() => chain),
    insert: vi.fn(async () => ({ error: null })),
    delete: vi.fn(() => chain),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(updateResult).then(resolve, reject),
  }
  return chain
}

describe('T-103 user management actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    getSessionUser.mockResolvedValue(actor)
    createClient.mockResolvedValue({})
    canManageTargetUser.mockResolvedValue(true)
  })

  it('invites a Spectator in the inviter unit and records the action', async () => {
    const profiles = createChain({ data: null, error: null })
    const roles = createChain({ data: { id: 1 }, error: null })
    const audit = createChain({ data: null, error: null })
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
      error: null,
    })
    const admin = {
      auth: { admin: { inviteUserByEmail, updateUserById: vi.fn(), deleteUser: vi.fn() } },
      from: vi.fn((table: string) => {
        if (table === 'roles') return roles
        if (table === 'users') return profiles
        return audit
      }),
    }
    createAdminClient.mockReturnValue(admin)

    const result = await inviteUser({ name: 'New User', email: ' NEW@example.test ' })

    expect(result).toEqual({
      ok: true,
      message: 'Undangan terkirim. User baru berstatus Spectator.',
    })
    expect(inviteUserByEmail).toHaveBeenCalledWith('new@example.test', {
      data: { name: 'New User' },
      redirectTo: 'http://localhost:3000/auth/confirm?next=/accept-invite',
    })
    expect(profiles.update).toHaveBeenCalledWith({
      name: 'New User',
      email: 'new@example.test',
      role_id: 1,
      org_unit_id: actor.orgUnitId,
      supervisor_id: null,
      status: 'aktif',
    })
    expect(audit.insert).toHaveBeenCalledOnce()
    expect(revalidatePath).toHaveBeenCalledWith('/users')
  })

  it('does not let a GM directly assign a role', async () => {
    getSessionUser.mockResolvedValue({
      ...actor,
      role: 'GM',
      roleLevel: 5,
    })

    const result = await assignUserRole({
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      roleId: 2,
      orgUnitId: 4,
      supervisorId: null,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Hanya Super Admin yang dapat menetapkan role dan penempatan.',
    })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('allows a GM to submit a validated proposal without changing the user role', async () => {
    const gm = { ...actor, role: 'GM' as const, roleLevel: 5, orgUnitId: 1 }
    getSessionUser.mockResolvedValue(gm)
    const target = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Existing User',
      role_id: 2,
      org_unit_id: 4,
      supervisor_id: null,
      status: 'aktif',
    }
    const orgUnits = [
      { id: 1, parent_id: null, type: 'department' },
      { id: 2, parent_id: 1, type: 'unit' },
      { id: 4, parent_id: 2, type: 'section' },
    ]
    const users = {
      select: vi.fn(() => users),
      eq: vi.fn(() => users),
      maybeSingle: vi.fn(async () => ({ data: target, error: null })),
      update: vi.fn(() => users),
    }
    const roleFilters: Record<string, unknown> = {}
    const roles = {
      select: vi.fn(() => roles),
      eq: vi.fn((column: string, value: unknown) => {
        roleFilters[column] = value
        return roles
      }),
      single: vi.fn(async () => roleFilters.id === 2
        ? { data: { id: 2, name: 'Staff/PIC' }, error: null }
        : { data: { id: 1, name: 'Spectator' }, error: null }),
    }
    const makeOrgUnitQuery = () => {
      const filters: Record<string, unknown> = {}
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn((column: string, value: unknown) => {
          filters[column] = value
          return query
        }),
        single: vi.fn(async () => ({
          data: orgUnits.find(({ id }) => id === filters.id),
          error: null,
        })),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve({ data: orgUnits, error: null }).then(resolve, reject),
      }
      return query
    }
    const requestBuilder = {
      insert: vi.fn(() => requestBuilder),
      select: vi.fn(() => requestBuilder),
      single: vi.fn(async () => ({
        data: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
        error: null,
      })),
      delete: vi.fn(() => requestBuilder),
      eq: vi.fn(() => requestBuilder),
    }
    const audit = { insert: vi.fn(async () => ({ error: null })) }
    const admin = {
      auth: { admin: {} },
      from: vi.fn((table: string) => {
        if (table === 'users') return users
        if (table === 'roles') return roles
        if (table === 'org_units') return makeOrgUnitQuery()
        if (table === 'role_change_requests') return requestBuilder
        return audit
      }),
    }
    const readableUnits = makeOrgUnitQuery()
    createClient.mockResolvedValue({ from: vi.fn(() => readableUnits) })
    createAdminClient.mockReturnValue(admin)

    const result = await proposeUserRoleChange({
      userId: target.id,
      roleId: 1,
      orgUnitId: 1,
      supervisorId: null,
    })

    expect(result).toEqual({
      ok: true,
      message: 'Usulan perubahan role dikirim kepada Super Admin.',
    })
    expect(requestBuilder.insert).toHaveBeenCalledWith({
      target_user_id: target.id,
      requested_by: gm.id,
      requested_role_id: 1,
      requested_org_unit_id: 1,
      requested_supervisor_id: null,
    })
    expect(users.update).not.toHaveBeenCalled()
    expect(audit.insert).toHaveBeenCalledOnce()
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'propose-role',
      object: `users:${target.id}`,
      new_value: expect.stringContaining('dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
    }))
  })

  it('does not allow an SM to submit a role-change proposal', async () => {
    const result = await proposeUserRoleChange({
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      roleId: 1,
      orgUnitId: 1,
      supervisorId: null,
    })

    expect(result).toEqual({
      ok: false,
      error: 'Hanya GM yang dapat mengusulkan perubahan role.',
    })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('does not allow a GM to decide a role-change proposal', async () => {
    getSessionUser.mockResolvedValue({ ...actor, role: 'GM', roleLevel: 5 })

    const result = await decideUserRoleChange({
      requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      decision: 'approved',
    })

    expect(result).toEqual({
      ok: false,
      error: 'Hanya Super Admin yang dapat memproses usulan role.',
    })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('lets a Super Admin reject a pending proposal and records the decision', async () => {
    getSessionUser.mockResolvedValue({
      ...actor,
      role: 'Super Admin',
      roleLevel: 6,
      orgUnitId: 1,
    })
    const target = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Existing User',
      role_id: 2,
      org_unit_id: 4,
      supervisor_id: null,
      status: 'aktif',
    }
    const users = {
      select: vi.fn(() => users),
      eq: vi.fn(() => users),
      maybeSingle: vi.fn(async () => ({ data: target, error: null })),
      update: vi.fn(() => users),
    }
    const request = {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      target_user_id: target.id,
      requested_role_id: 1,
      requested_org_unit_id: 1,
      requested_supervisor_id: null,
    }
    let isUpdate = false
    const requestBuilder = {
      select: vi.fn(() => requestBuilder),
      eq: vi.fn(() => requestBuilder),
      maybeSingle: vi.fn(async () => ({
        data: isUpdate ? { id: request.id } : request,
        error: null,
      })),
      update: vi.fn(() => {
        isUpdate = true
        return requestBuilder
      }),
    }
    const audit = { insert: vi.fn(async () => ({ error: null })) }
    createAdminClient.mockReturnValue({
      auth: { admin: {} },
      from: vi.fn((table: string) => {
        if (table === 'users') return users
        if (table === 'role_change_requests') return requestBuilder
        return audit
      }),
    })

    const result = await decideUserRoleChange({
      requestId: request.id,
      decision: 'rejected',
    })

    expect(result).toEqual({ ok: true, message: 'Usulan perubahan role ditolak.' })
    expect(requestBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'rejected',
      decided_by: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }))
    expect(users.update).not.toHaveBeenCalled()
    expect(audit.insert).toHaveBeenCalledOnce()
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'reject-role-proposal',
      object: `users:${target.id}`,
    }))
  })

  it('applies an approved proposal and audits both the assignment and decision', async () => {
    const superAdmin = {
      ...actor,
      role: 'Super Admin' as const,
      roleLevel: 6,
      orgUnitId: 1,
    }
    getSessionUser.mockResolvedValue(superAdmin)
    const target = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Existing User',
      role_id: 2,
      org_unit_id: 4,
      supervisor_id: null,
      status: 'aktif',
    }
    const proposal = {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      target_user_id: target.id,
      requested_role_id: 1,
      requested_org_unit_id: 1,
      requested_supervisor_id: null,
    }
    const users = {
      select: vi.fn(() => users),
      eq: vi.fn(() => users),
      maybeSingle: vi.fn(async () => ({ data: target, error: null })),
      update: vi.fn(() => users),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(resolve, reject),
    }
    const roles = {
      select: vi.fn(() => roles),
      eq: vi.fn(() => roles),
      single: vi.fn(async () => ({ data: { id: 1, name: 'Spectator' }, error: null })),
    }
    const orgUnits = [
      { id: 1, parent_id: null, type: 'department' },
    ]
    const unitFilters: Record<string, unknown> = {}
    const unitQuery = {
      select: vi.fn(() => unitQuery),
      eq: vi.fn((column: string, value: unknown) => {
        unitFilters[column] = value
        return unitQuery
      }),
      single: vi.fn(async () => ({
        data: orgUnits.find(({ id }) => id === unitFilters.id),
        error: null,
      })),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: orgUnits, error: null }).then(resolve, reject),
    }
    let requestUpdate = false
    const requestBuilder = {
      select: vi.fn(() => requestBuilder),
      eq: vi.fn(() => requestBuilder),
      maybeSingle: vi.fn(async () => ({
        data: requestUpdate ? { id: proposal.id } : proposal,
        error: null,
      })),
      update: vi.fn(() => {
        requestUpdate = true
        return requestBuilder
      }),
    }
    const audit = { insert: vi.fn(async () => ({ error: null })) }
    createAdminClient.mockReturnValue({
      auth: { admin: {} },
      from: vi.fn((table: string) => {
        if (table === 'users') return users
        if (table === 'roles') return roles
        if (table === 'org_units') return unitQuery
        if (table === 'role_change_requests') return requestBuilder
        return audit
      }),
    })

    const result = await decideUserRoleChange({
      requestId: proposal.id,
      decision: 'approved',
    })

    expect(result).toEqual({
      ok: true,
      message: 'Usulan disetujui dan role user diperbarui.',
    })
    expect(users.update).toHaveBeenCalledWith({
      role_id: proposal.requested_role_id,
      org_unit_id: proposal.requested_org_unit_id,
      supervisor_id: null,
    })
    expect(audit.insert).toHaveBeenCalledTimes(2)
    expect(audit.insert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      action: 'assign-role',
      object: `users:${target.id}`,
    }))
    expect(audit.insert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      action: 'approve-role-proposal',
      object: `users:${target.id}`,
      new_value: JSON.stringify({ requestId: proposal.id, status: 'approved' }),
    }))
  })

  it('lets a Super Admin assign one role, placement, and valid supervisor', async () => {
    const superAdmin = {
      ...actor,
      role: 'Super Admin' as const,
      roleLevel: 6,
      orgUnitId: 1,
    }
    getSessionUser.mockResolvedValue(superAdmin)

    const target = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'New Staff',
      role_id: 1,
      org_unit_id: 1,
      supervisor_id: null,
      status: 'aktif',
    }
    const manager = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      name: 'Section Manager',
      role_id: 3,
      org_unit_id: 4,
      status: 'aktif',
    }
    const orgUnits = [
      { id: 1, parent_id: null, type: 'department' },
      { id: 2, parent_id: 1, type: 'unit' },
      { id: 3, parent_id: 1, type: 'unit' },
      { id: 4, parent_id: 2, type: 'section' },
    ] as const
    const profileFilters: Record<string, unknown> = {}
    const profiles = {
      select: vi.fn(() => profiles),
      eq: vi.fn((column: string, value: unknown) => {
        profileFilters[column] = value
        return profiles
      }),
      maybeSingle: vi.fn(async () => ({
        data: profileFilters.id === manager.id ? manager : target,
        error: null,
      })),
      update: vi.fn(() => profiles),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(resolve, reject),
    }
    const roleFilters: Record<string, unknown> = {}
    const roles = {
      select: vi.fn(() => roles),
      eq: vi.fn((column: string, value: unknown) => {
        roleFilters[column] = value
        return roles
      }),
      single: vi.fn(async () => ({
        data: roleFilters.id === 3
          ? { id: 3, name: 'Manager' }
          : { id: 2, name: 'Staff/PIC' },
        error: null,
      })),
    }
    const unitFilters: Record<string, unknown> = {}
    const units = {
      select: vi.fn(() => units),
      eq: vi.fn((column: string, value: unknown) => {
        unitFilters[column] = value
        return units
      }),
      single: vi.fn(async () => ({
        data: orgUnits.find(({ id }) => id === unitFilters.id),
        error: null,
      })),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: [...orgUnits], error: null }).then(resolve, reject),
    }
    const audit = {
      insert: vi.fn(async () => ({ error: null })),
    }
    const admin = {
      auth: { admin: {} },
      from: vi.fn((table: string) => {
        if (table === 'users') return profiles
        if (table === 'roles') return roles
        if (table === 'org_units') return units
        return audit
      }),
    }
    createAdminClient.mockReturnValue(admin)

    const result = await assignUserRole({
      userId: target.id,
      roleId: 2,
      orgUnitId: 4,
      supervisorId: manager.id,
    })

    expect(result).toEqual({ ok: true, message: 'Role dan penempatan user diperbarui.' })
    expect(profiles.update).toHaveBeenCalledWith({
      role_id: 2,
      org_unit_id: 4,
      supervisor_id: manager.id,
    })
    expect(audit.insert).toHaveBeenCalledOnce()
    expect(audit.insert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'assign-role',
      user_id: superAdmin.id,
      object: `users:${target.id}`,
    }))
  })

  it('blocks unauthorised target operations before calling Auth Admin', async () => {
    const users = createChain({
      data: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Target',
        role_id: 2,
        org_unit_id: 4,
        status: 'aktif',
      },
      error: null,
    })
    const roles = createChain({ data: { name: 'Staff/PIC' }, error: null })
    const updateUserById = vi.fn()
    createAdminClient.mockReturnValue({
      auth: { admin: { updateUserById } },
      from: vi.fn((table: string) => table === 'users' ? users : roles),
    })
    canManageTargetUser.mockResolvedValue(false)

    const result = await updateUserStatus({
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      status: 'nonaktif',
    })

    expect(result).toEqual({
      ok: false,
      error: 'Anda tidak berwenang mengubah user ini.',
    })
    expect(updateUserById).not.toHaveBeenCalled()
  })

  it('blocks login in Auth before changing the profile status', async () => {
    const users = createChain({
      data: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Target',
        role_id: 2,
        org_unit_id: 4,
        status: 'aktif',
      },
      error: null,
    })
    const roles = createChain({ data: { name: 'Staff/PIC' }, error: null })
    const updateUserById = vi.fn().mockResolvedValue({ error: null })
    const admin = {
      auth: { admin: { updateUserById } },
      from: vi.fn((table: string) => table === 'users' ? users : roles),
    }
    createAdminClient.mockReturnValue(admin)

    const result = await updateUserStatus({
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      status: 'nonaktif',
    })

    expect(result).toEqual({ ok: true, message: 'User dinonaktifkan.' })
    expect(updateUserById).toHaveBeenCalledWith(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      { ban_duration: '876000h' },
    )
    expect(users.update).toHaveBeenCalledWith({ status: 'nonaktif' })
  })

  it('removes the Auth ban before reactivating an account profile', async () => {
    const users = createChain({
      data: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Target',
        role_id: 2,
        org_unit_id: 4,
        status: 'nonaktif',
      },
      error: null,
    })
    const roles = createChain({ data: { name: 'Staff/PIC' }, error: null })
    const updateUserById = vi.fn().mockResolvedValue({ error: null })
    createAdminClient.mockReturnValue({
      auth: { admin: { updateUserById } },
      from: vi.fn((table: string) => table === 'users' ? users : roles),
    })

    const result = await updateUserStatus({
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      status: 'aktif',
    })

    expect(result).toEqual({ ok: true, message: 'User diaktifkan kembali.' })
    expect(updateUserById).toHaveBeenCalledWith(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      { ban_duration: 'none' },
    )
    expect(users.update).toHaveBeenCalledWith({ status: 'aktif' })
  })

  it('does not update the profile if Supabase Auth rejects a ban', async () => {
    const users = createChain({
      data: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Target',
        role_id: 2,
        org_unit_id: 4,
        status: 'aktif',
      },
      error: null,
    })
    const roles = createChain({ data: { name: 'Staff/PIC' }, error: null })
    const updateUserById = vi.fn().mockResolvedValue({ error: new Error('auth unavailable') })
    createAdminClient.mockReturnValue({
      auth: { admin: { updateUserById } },
      from: vi.fn((table: string) => table === 'users' ? users : roles),
    })

    const result = await updateUserStatus({
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      status: 'nonaktif',
    })

    expect(result).toEqual({
      ok: false,
      error: 'Status login akun tidak dapat diperbarui.',
    })
    expect(users.update).not.toHaveBeenCalled()
  })
})
