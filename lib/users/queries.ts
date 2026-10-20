import { getSessionUser } from '@/lib/auth/session'
import { ROLE_LEVELS } from '@/lib/constants/rbac'
import { createClient } from '@/lib/supabase/server'
import { getManageableOrgUnitIds } from './scope'

export type ManagedUser = {
  id: string
  name: string
  email: string
  status: 'aktif' | 'nonaktif'
  role: string
  orgUnitName: string
  orgUnitId: number
  supervisorId: string | null
}

export type UserAssignmentOptions = {
  roles: { id: number; name: string }[]
  orgUnits: { id: number; name: string; type: 'department' | 'unit' | 'section'; parentId: number | null }[]
  users: { id: string; name: string; role: string; orgUnitId: number; status: 'aktif' | 'nonaktif' }[]
}

export type PendingRoleChangeRequest = {
  id: string
  targetUserId: string
  targetName: string
  requesterName: string
  roleName: string
  orgUnitName: string
  supervisorName: string | null
  createdAt: string
}

export async function getManagedUsers(): Promise<ManagedUser[]> {
  const user = await getSessionUser()
  if (user.roleLevel < ROLE_LEVELS.SM) return []

  const supabase = await createClient()
  const orgUnitIds = await getManageableOrgUnitIds(supabase, user)
  if (orgUnitIds.length === 0) return []

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, email, status, role_id, org_unit_id, supervisor_id')
    .in('org_unit_id', orgUnitIds)
    .order('name')

  if (usersError) throw new Error('Gagal memuat daftar user.')
  if (!users?.length) return []

  const roleIds = [...new Set(users.map(({ role_id }) => role_id))]
  const unitIds = [...new Set(users.map(({ org_unit_id }) => org_unit_id))]
  const [{ data: roles, error: rolesError }, { data: orgUnits, error: unitsError }] =
    await Promise.all([
      supabase.from('roles').select('id, name').in('id', roleIds),
      supabase.from('org_units').select('id, name').in('id', unitIds),
    ])

  if (rolesError || unitsError) throw new Error('Gagal memuat informasi role atau unit user.')

  const roleNames = new Map((roles ?? []).map(({ id, name }) => [id, name]))
  const unitNames = new Map((orgUnits ?? []).map(({ id, name }) => [id, name]))

  return users.map((profile) => ({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    status: profile.status,
    role: roleNames.get(profile.role_id) ?? 'Tidak diketahui',
    orgUnitName: unitNames.get(profile.org_unit_id) ?? 'Tidak diketahui',
    orgUnitId: profile.org_unit_id,
    supervisorId: profile.supervisor_id,
  }))
}

export async function getUserAssignmentOptions(): Promise<UserAssignmentOptions> {
  const user = await getSessionUser()
  if (user.role !== 'Super Admin' && user.role !== 'GM') {
    throw new Error('Hanya GM dan Super Admin yang dapat memuat opsi role dan penempatan.')
  }

  const supabase = await createClient()
  const [{ data: roles, error: rolesError }, { data: orgUnits, error: unitsError }, { data: users, error: usersError }] =
    await Promise.all([
      supabase.from('roles').select('id, name').order('level'),
      supabase.from('org_units').select('id, name, type, parent_id').order('id'),
      supabase.from('users').select('id, name, role_id, org_unit_id, status'),
    ])

  if (rolesError || unitsError || usersError) {
    throw new Error('Gagal memuat pilihan role, unit, atau supervisor.')
  }

  const roleNames = new Map((roles ?? []).map(({ id, name }) => [id, name]))
  return {
    roles: (roles ?? []).map(({ id, name }) => ({ id, name })),
    orgUnits: (orgUnits ?? []).map(({ id, name, type, parent_id }) => ({
      id,
      name,
      type,
      parentId: parent_id,
    })),
    users: (users ?? []).map(({ id, name, role_id, org_unit_id, status }) => ({
      id,
      name,
      role: roleNames.get(role_id) ?? 'Tidak diketahui',
      orgUnitId: org_unit_id,
      status,
    })),
  }
}

export async function getPendingRoleChangeRequests(): Promise<PendingRoleChangeRequest[]> {
  const user = await getSessionUser()
  if (user.role !== 'Super Admin') {
    throw new Error('Hanya Super Admin yang dapat memuat usulan perubahan role.')
  }

  const supabase = await createClient()
  const { data: requests, error: requestsError } = await supabase
    .from('role_change_requests')
    .select('id, target_user_id, requested_by, requested_role_id, requested_org_unit_id, requested_supervisor_id, created_at')
    .eq('status', 'pending')
    .order('created_at')

  if (requestsError) {
    console.error('[users] pending role change requests query failed', {
      name: requestsError.name,
      code: requestsError.code,
      message: requestsError.message,
    })
    throw new Error('Gagal memuat usulan perubahan role.')
  }
  if (!requests?.length) return []

  const roleIds = [...new Set(requests.map(({ requested_role_id }) => requested_role_id))]
  const orgUnitIds = [...new Set(requests.map(({ requested_org_unit_id }) => requested_org_unit_id))]
  const userIds = [...new Set(requests.flatMap(({ target_user_id, requested_by, requested_supervisor_id }) =>
    [target_user_id, requested_by, ...(requested_supervisor_id ? [requested_supervisor_id] : [])],
  ))]
  const [{ data: roles, error: rolesError }, { data: orgUnits, error: unitsError }, { data: users, error: usersError }] =
    await Promise.all([
      supabase.from('roles').select('id, name').in('id', roleIds),
      supabase.from('org_units').select('id, name').in('id', orgUnitIds),
      supabase.from('users').select('id, name').in('id', userIds),
    ])

  if (rolesError || unitsError || usersError) {
    throw new Error('Gagal memuat detail usulan perubahan role.')
  }

  const roleNames = new Map((roles ?? []).map(({ id, name }) => [id, name]))
  const unitNames = new Map((orgUnits ?? []).map(({ id, name }) => [id, name]))
  const userNames = new Map((users ?? []).map(({ id, name }) => [id, name]))

  return requests.map((request) => ({
    id: request.id,
    targetUserId: request.target_user_id,
    targetName: userNames.get(request.target_user_id) ?? 'User tidak ditemukan',
    requesterName: userNames.get(request.requested_by) ?? 'GM tidak ditemukan',
    roleName: roleNames.get(request.requested_role_id) ?? 'Role tidak ditemukan',
    orgUnitName: unitNames.get(request.requested_org_unit_id) ?? 'Penempatan tidak ditemukan',
    supervisorName: request.requested_supervisor_id
      ? userNames.get(request.requested_supervisor_id) ?? 'Atasan tidak ditemukan'
      : null,
    createdAt: request.created_at,
  }))
}
