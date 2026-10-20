'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/auth/session'
import { ROLES, type RoleName } from '@/lib/constants/rbac'
import { createAdminClient, AdminConfigurationError } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isValidUserAssignment, type OrganizationalUnit } from './assignment'
import { isRoleName } from './permissions'
import { canManageTargetUser } from './scope'
import {
  type AssignUserRoleInput,
  validateAssignUserRoleInput,
  validateCreateUserInviteInput,
  validateDecideUserRoleChangeInput,
  validateUpdateUserNameInput,
  validateUpdateUserStatusInput,
} from './validation'

export type UserActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string }

type TargetUser = {
  id: string
  name: string
  role_id: number
  org_unit_id: number
  supervisor_id: string | null
  status: 'aktif' | 'nonaktif'
}

function recordAdminConfigurationError(error: unknown): UserActionResult | null {
  if (!(error instanceof AdminConfigurationError)) return null
  return {
    ok: false,
    error: 'Fitur pengelolaan user belum dikonfigurasi oleh administrator sistem.',
  }
}

async function getTargetUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<TargetUser | null> {
  const { data, error } = await admin
    .from('users')
    .select('id, name, role_id, org_unit_id, supervisor_id, status')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error('Gagal membaca profil user.')
  return data
}

async function isAuthorizedTarget(
  target: TargetUser,
  actor: Awaited<ReturnType<typeof getSessionUser>>,
  admin: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  const [{ data: role, error: roleError }, supabase] = await Promise.all([
    admin.from('roles').select('name').eq('id', target.role_id).single(),
    createClient(),
  ])

  if (roleError || !role || !isRoleName(role.name)) {
    throw new Error('Gagal memeriksa role user.')
  }
  return canManageTargetUser(supabase, actor, {
    id: target.id,
    role: role.name,
    orgUnitId: target.org_unit_id,
  })
}

async function writeAuditLog(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  action: string,
  targetId: string,
  oldValue: string | null,
  newValue: string | null,
) {
  const { error } = await admin.from('audit_logs').insert({
    user_id: actorId,
    action,
    object: `users:${targetId}`,
    old_value: oldValue,
    new_value: newValue,
  })

  if (error) throw new Error('Gagal mencatat perubahan user pada audit log.')
}

type ValidatedAssignment = {
  roleId: number
  orgUnitId: number
  supervisorId: string | null
}

async function validateUserAssignment(
  admin: ReturnType<typeof createAdminClient>,
  input: AssignUserRoleInput,
): Promise<{ assignment: ValidatedAssignment } | { error: string }> {
  const [
    { data: role, error: roleError },
    { data: orgUnit, error: unitError },
    { data: orgUnitRows, error: unitsError },
  ] = await Promise.all([
    admin.from('roles').select('id, name').eq('id', input.roleId).single(),
    admin.from('org_units').select('id, parent_id, type').eq('id', input.orgUnitId).single(),
    admin.from('org_units').select('id, parent_id, type'),
  ])

  if (roleError || !role || !isRoleName(role.name)) {
    return { error: 'Role yang dipilih tidak tersedia.' }
  }
  if (unitError || !orgUnit || unitsError || !orgUnitRows) {
    return { error: 'Unit atau section yang dipilih tidak tersedia.' }
  }

  let supervisor: {
    role: RoleName
    orgUnitId: number
    status: 'aktif' | 'nonaktif'
  } | null = null

  if (input.supervisorId) {
    const { data: supervisorProfile, error: supervisorError } = await admin
      .from('users')
      .select('id, role_id, org_unit_id, status')
      .eq('id', input.supervisorId)
      .maybeSingle()

    if (supervisorError || !supervisorProfile) {
      return { error: 'Atasan yang dipilih tidak ditemukan.' }
    }

    const { data: supervisorRole, error: supervisorRoleError } = await admin
      .from('roles')
      .select('name')
      .eq('id', supervisorProfile.role_id)
      .single()

    if (supervisorRoleError || !supervisorRole || !isRoleName(supervisorRole.name)) {
      return { error: 'Role atasan tidak dapat diverifikasi.' }
    }

    supervisor = {
      role: supervisorRole.name,
      orgUnitId: supervisorProfile.org_unit_id,
      status: supervisorProfile.status,
    }
  }

  const unit = {
    id: orgUnit.id,
    parentId: orgUnit.parent_id,
    type: orgUnit.type,
  } satisfies OrganizationalUnit
  const units = orgUnitRows.map(({ id, parent_id, type }) => ({
    id,
    parentId: parent_id,
    type,
  })) satisfies OrganizationalUnit[]

  if (!isValidUserAssignment(role.name, unit, supervisor, units)) {
    return {
      error: 'Kombinasi role, unit/section, atau atasan tidak sesuai struktur organisasi.',
    }
  }

  return {
    assignment: {
      roleId: role.id,
      orgUnitId: orgUnit.id,
      supervisorId: input.supervisorId,
    },
  }
}

async function cleanUpInvitedUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<boolean> {
  try {
    const { error: profileError } = await admin.from('users').delete().eq('id', userId)
    if (profileError) return false

    const { error: authError } = await admin.auth.admin.deleteUser(userId)
    return !authError
  } catch {
    return false
  }
}

export async function inviteUser(input: unknown): Promise<UserActionResult> {
  const validated = validateCreateUserInviteInput(input)
  if (!validated) {
    return { ok: false, error: 'Nama atau email tidak valid.' }
  }

  const actor = await getSessionUser()
  if (actor.role !== ROLES.SM && actor.role !== ROLES.GM && actor.role !== ROLES.SUPER_ADMIN) {
    return { ok: false, error: 'Anda tidak berwenang mengelola user.' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    return recordAdminConfigurationError(error) ?? {
      ok: false,
      error: 'Tidak dapat menyiapkan pengelolaan user.',
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return { ok: false, error: 'URL aplikasi belum dikonfigurasi.' }
  }

  let inviteUrl: string
  try {
    const parsedAppUrl = new URL(appUrl)
    if (parsedAppUrl.protocol !== 'https:' && parsedAppUrl.hostname !== 'localhost') {
      return { ok: false, error: 'URL aplikasi harus menggunakan HTTPS.' }
    }
    inviteUrl = new URL('/auth/confirm?next=/accept-invite', parsedAppUrl).toString()
  } catch {
    return { ok: false, error: 'URL aplikasi tidak valid.' }
  }

  const { data: spectatorRole, error: roleError } = await admin
    .from('roles')
    .select('id')
    .eq('name', ROLES.SPECTATOR)
    .single()

  if (roleError || !spectatorRole) {
    return { ok: false, error: 'Role Spectator belum tersedia.' }
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    validated.email,
    {
      data: { name: validated.name },
      redirectTo: inviteUrl,
    },
  )

  if (inviteError || !invited.user) {
    if (inviteError?.message.toLowerCase().includes('already')) {
      return { ok: false, error: 'Email tersebut sudah terdaftar.' }
    }
    return { ok: false, error: 'Undangan tidak dapat dikirim. Silakan coba lagi.' }
  }

  const { error: profileError } = await admin
    .from('users')
    .update({
      name: validated.name,
      email: validated.email,
      role_id: spectatorRole.id,
      org_unit_id: actor.orgUnitId,
      supervisor_id: null,
      status: 'aktif',
    })
    .eq('id', invited.user.id)

  if (profileError) {
    const cleaned = await cleanUpInvitedUser(admin, invited.user.id)
    return {
      ok: false,
      error: cleaned
        ? 'Profil undangan gagal disiapkan; undangan dibatalkan.'
        : 'Profil undangan gagal disiapkan dan pembersihan akun tidak tuntas. Hubungi administrator.',
    }
  }

  try {
    await writeAuditLog(
      admin,
      actor.id,
      'invite',
      invited.user.id,
      null,
      JSON.stringify({
        name: validated.name,
        email: validated.email,
        role: ROLES.SPECTATOR,
        orgUnitId: actor.orgUnitId,
      }),
    )
  } catch {
    const cleaned = await cleanUpInvitedUser(admin, invited.user.id)
    return {
      ok: false,
      error: cleaned
        ? 'Undangan dibatalkan karena perubahan tidak dapat dicatat.'
        : 'Audit undangan gagal dan pembersihan akun tidak tuntas. Hubungi administrator.',
    }
  }

  revalidatePath('/users')
  return { ok: true, message: 'Undangan terkirim. User baru berstatus Spectator.' }
}

export async function updateUserName(input: unknown): Promise<UserActionResult> {
  const validated = validateUpdateUserNameInput(input)
  if (!validated) return { ok: false, error: 'Nama user tidak valid.' }

  const actor = await getSessionUser()
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    return recordAdminConfigurationError(error) ?? {
      ok: false,
      error: 'Tidak dapat menyiapkan pengelolaan user.',
    }
  }

  const target = await getTargetUser(admin, validated.userId)
  if (!target) return { ok: false, error: 'User tidak ditemukan.' }
  if (!(await isAuthorizedTarget(target, actor, admin))) {
    return { ok: false, error: 'Anda tidak berwenang mengubah user ini.' }
  }

  const { error: updateError } = await admin
    .from('users')
    .update({ name: validated.name })
    .eq('id', target.id)

  if (updateError) return { ok: false, error: 'Nama user tidak dapat diperbarui.' }

  try {
    await writeAuditLog(
      admin,
      actor.id,
      'update-name',
      target.id,
      target.name,
      validated.name,
    )
  } catch {
    const { error: rollbackError } = await admin
      .from('users')
      .update({ name: target.name })
      .eq('id', target.id)
    if (rollbackError) {
      return {
        ok: false,
        error: 'Audit gagal dan nama user tidak dapat dipulihkan. Hubungi administrator.',
      }
    }
    return { ok: false, error: 'Perubahan nama dibatalkan karena audit log gagal.' }
  }

  revalidatePath('/users')
  return { ok: true, message: 'Nama user diperbarui.' }
}

export async function assignUserRole(input: unknown): Promise<UserActionResult> {
  const validated = validateAssignUserRoleInput(input)
  if (!validated) return { ok: false, error: 'Data role atau penempatan tidak valid.' }

  const actor = await getSessionUser()
  if (actor.role !== ROLES.SUPER_ADMIN) {
    return { ok: false, error: 'Hanya Super Admin yang dapat menetapkan role dan penempatan.' }
  }
  if (actor.id === validated.userId || validated.supervisorId === validated.userId) {
    return { ok: false, error: 'User tidak dapat menjadi target atau atasannya sendiri.' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    return recordAdminConfigurationError(error) ?? {
      ok: false,
      error: 'Tidak dapat menyiapkan pengelolaan user.',
    }
  }

  const target = await getTargetUser(admin, validated.userId)
  if (!target) return { ok: false, error: 'User tidak ditemukan.' }

  const assignmentResult = await validateUserAssignment(admin, validated)
  if ('error' in assignmentResult) return { ok: false, error: assignmentResult.error }
  const { assignment } = assignmentResult

  if (
    target.role_id === assignment.roleId &&
    target.org_unit_id === assignment.orgUnitId &&
    target.supervisor_id === assignment.supervisorId
  ) {
    return { ok: true, message: 'Role dan penempatan user tidak berubah.' }
  }

  const assignmentUpdate = {
    role_id: assignment.roleId,
    org_unit_id: assignment.orgUnitId,
    supervisor_id: assignment.supervisorId,
  }
  const { error: updateError } = await admin
    .from('users')
    .update(assignmentUpdate)
    .eq('id', target.id)

  if (updateError) return { ok: false, error: 'Role dan penempatan user tidak dapat diperbarui.' }

  try {
    await writeAuditLog(
      admin,
      actor.id,
      'assign-role',
      target.id,
      JSON.stringify({
        roleId: target.role_id,
        orgUnitId: target.org_unit_id,
        supervisorId: target.supervisor_id,
      }),
      JSON.stringify({
        roleId: assignment.roleId,
        orgUnitId: assignment.orgUnitId,
        supervisorId: assignment.supervisorId,
      }),
    )
  } catch {
    const { error: rollbackError } = await admin
      .from('users')
      .update({
        role_id: target.role_id,
        org_unit_id: target.org_unit_id,
        supervisor_id: target.supervisor_id,
      })
      .eq('id', target.id)
    if (rollbackError) {
      return {
        ok: false,
        error: 'Audit gagal dan penempatan user tidak dapat dipulihkan. Hubungi administrator.',
      }
    }
    return { ok: false, error: 'Perubahan role dibatalkan karena audit log gagal.' }
  }

  revalidatePath('/users')
  revalidatePath('/dashboard')
  return { ok: true, message: 'Role dan penempatan user diperbarui.' }
}

export async function proposeUserRoleChange(input: unknown): Promise<UserActionResult> {
  const validated = validateAssignUserRoleInput(input)
  if (!validated) return { ok: false, error: 'Data usulan role atau penempatan tidak valid.' }

  const actor = await getSessionUser()
  if (actor.role !== ROLES.GM) {
    return { ok: false, error: 'Hanya GM yang dapat mengusulkan perubahan role.' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    return recordAdminConfigurationError(error) ?? {
      ok: false,
      error: 'Tidak dapat menyiapkan pengelolaan user.',
    }
  }

  const target = await getTargetUser(admin, validated.userId)
  if (!target) return { ok: false, error: 'User tidak ditemukan.' }
  if (!(await isAuthorizedTarget(target, actor, admin))) {
    return { ok: false, error: 'Anda tidak berwenang mengusulkan perubahan untuk user ini.' }
  }

  const assignmentResult = await validateUserAssignment(admin, validated)
  if ('error' in assignmentResult) return { ok: false, error: assignmentResult.error }
  const { assignment } = assignmentResult

  if (
    target.role_id === assignment.roleId &&
    target.org_unit_id === assignment.orgUnitId &&
    target.supervisor_id === assignment.supervisorId
  ) {
    return { ok: false, error: 'Role dan penempatan user sudah sesuai; tidak ada perubahan untuk diusulkan.' }
  }

  const { data: request, error: requestError } = await admin
    .from('role_change_requests')
    .insert({
      target_user_id: target.id,
      requested_by: actor.id,
      requested_role_id: assignment.roleId,
      requested_org_unit_id: assignment.orgUnitId,
      requested_supervisor_id: assignment.supervisorId,
    })
    .select('id')
    .single()

  if (requestError || !request) {
    return {
      ok: false,
      error: 'Usulan tidak dapat disimpan. Periksa apakah sudah ada usulan yang menunggu untuk user ini.',
    }
  }

  try {
    await writeAuditLog(
      admin,
      actor.id,
      'propose-role',
      target.id,
      JSON.stringify({
        roleId: target.role_id,
        orgUnitId: target.org_unit_id,
        supervisorId: target.supervisor_id,
      }),
      JSON.stringify({
        requestId: request.id,
        roleId: assignment.roleId,
        orgUnitId: assignment.orgUnitId,
        supervisorId: assignment.supervisorId,
      }),
    )
  } catch {
    const { error: cleanupError } = await admin
      .from('role_change_requests')
      .delete()
      .eq('id', request.id)
    return {
      ok: false,
      error: cleanupError
        ? 'Audit usulan gagal dan usulan tidak dapat dibatalkan. Hubungi administrator.'
        : 'Usulan dibatalkan karena audit log gagal.',
    }
  }

  revalidatePath('/users')
  return { ok: true, message: 'Usulan perubahan role dikirim kepada Super Admin.' }
}

export async function decideUserRoleChange(input: unknown): Promise<UserActionResult> {
  const validated = validateDecideUserRoleChangeInput(input)
  if (!validated) return { ok: false, error: 'Keputusan usulan role tidak valid.' }

  const actor = await getSessionUser()
  if (actor.role !== ROLES.SUPER_ADMIN) {
    return { ok: false, error: 'Hanya Super Admin yang dapat memproses usulan role.' }
  }

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    return recordAdminConfigurationError(error) ?? {
      ok: false,
      error: 'Tidak dapat menyiapkan pengelolaan user.',
    }
  }

  const { data: request, error: requestError } = await admin
    .from('role_change_requests')
    .select('id, target_user_id, requested_role_id, requested_org_unit_id, requested_supervisor_id')
    .eq('id', validated.requestId)
    .eq('status', 'pending')
    .maybeSingle()

  if (requestError) return { ok: false, error: 'Gagal membaca usulan perubahan role.' }
  if (!request) return { ok: false, error: 'Usulan tidak ditemukan atau sudah diproses.' }

  const target = await getTargetUser(admin, request.target_user_id)
  if (!target) return { ok: false, error: 'User tujuan usulan tidak ditemukan.' }

  if (validated.decision === 'approved') {
    const result = await assignUserRole({
      userId: target.id,
      roleId: request.requested_role_id,
      orgUnitId: request.requested_org_unit_id,
      supervisorId: request.requested_supervisor_id,
    })
    if (!result.ok) return result
  }

  const decidedAt = new Date().toISOString()
  const { data: updatedRequest, error: updateError } = await admin
    .from('role_change_requests')
    .update({
      status: validated.decision,
      decided_by: actor.id,
      decided_at: decidedAt,
    })
    .eq('id', request.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (updateError || !updatedRequest) {
    return {
      ok: false,
      error: validated.decision === 'approved'
        ? 'Role sudah diperbarui, tetapi usulan belum dapat diselesaikan. Coba proses kembali.'
        : 'Usulan belum dapat diproses. Silakan coba lagi.',
    }
  }

  if (validated.decision === 'approved') {
    try {
      await writeAuditLog(
        admin,
        actor.id,
        'approve-role-proposal',
        target.id,
        JSON.stringify({ requestId: request.id, status: 'pending' }),
        JSON.stringify({ requestId: request.id, status: 'approved' }),
      )
    } catch {
      const { error: rollbackError } = await admin
        .from('role_change_requests')
        .update({ status: 'pending', decided_by: null, decided_at: null })
        .eq('id', request.id)
      if (rollbackError) {
        return {
          ok: false,
          error: 'Audit persetujuan gagal dan status usulan tidak dapat dipulihkan. Hubungi administrator.',
        }
      }
      return { ok: false, error: 'Usulan dikembalikan ke antrean karena audit persetujuan gagal.' }
    }
  } else {
    try {
      await writeAuditLog(
        admin,
        actor.id,
        'reject-role-proposal',
        target.id,
        JSON.stringify({ requestId: request.id, status: 'pending' }),
        JSON.stringify({ requestId: request.id, status: 'rejected' }),
      )
    } catch {
      const { error: rollbackError } = await admin
        .from('role_change_requests')
        .update({ status: 'pending', decided_by: null, decided_at: null })
        .eq('id', request.id)
      if (rollbackError) {
        return {
          ok: false,
          error: 'Audit penolakan gagal dan status usulan tidak dapat dipulihkan. Hubungi administrator.',
        }
      }
      return { ok: false, error: 'Penolakan dibatalkan karena audit log gagal.' }
    }
  }

  revalidatePath('/users')
  revalidatePath('/dashboard')
  return {
    ok: true,
    message: validated.decision === 'approved'
      ? 'Usulan disetujui dan role user diperbarui.'
      : 'Usulan perubahan role ditolak.',
  }
}

export async function updateUserStatus(input: unknown): Promise<UserActionResult> {
  const validated = validateUpdateUserStatusInput(input)
  if (!validated) return { ok: false, error: 'Status user tidak valid.' }

  const actor = await getSessionUser()
  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
  } catch (error) {
    return recordAdminConfigurationError(error) ?? {
      ok: false,
      error: 'Tidak dapat menyiapkan pengelolaan user.',
    }
  }

  const target = await getTargetUser(admin, validated.userId)
  if (!target) return { ok: false, error: 'User tidak ditemukan.' }
  if (!(await isAuthorizedTarget(target, actor, admin))) {
    return { ok: false, error: 'Anda tidak berwenang mengubah user ini.' }
  }
  if (target.status === validated.status) {
    return { ok: true, message: 'Status user tidak berubah.' }
  }

  const { data: targetRole, error: targetRoleError } = await admin
    .from('roles')
    .select('name')
    .eq('id', target.role_id)
    .single()
  if (targetRoleError || !targetRole) {
    return { ok: false, error: 'Gagal memeriksa role user.' }
  }

  const banDuration = validated.status === 'nonaktif' ? '876000h' : 'none'
  const { error: authError } = await admin.auth.admin.updateUserById(target.id, {
    ban_duration: banDuration,
  })
  if (authError) {
    return { ok: false, error: 'Status login akun tidak dapat diperbarui.' }
  }

  const { error: profileError } = await admin
    .from('users')
    .update({ status: validated.status })
    .eq('id', target.id)

  if (profileError) {
    const rollback = await admin.auth.admin.updateUserById(target.id, {
      ban_duration: target.status === 'nonaktif' ? '876000h' : 'none',
    })
    return {
      ok: false,
      error: rollback.error
        ? 'Status profil dan login tidak sinkron. Hubungi administrator.'
        : 'Status profil gagal diperbarui; perubahan login dibatalkan.',
    }
  }

  try {
    await writeAuditLog(
      admin,
      actor.id,
      validated.status === 'nonaktif' ? 'deactivate' : 'activate',
      target.id,
      target.status,
      validated.status,
    )
  } catch {
    const { error: profileRollbackError } = await admin
      .from('users')
      .update({ status: target.status })
      .eq('id', target.id)
    const authRollback = await admin.auth.admin.updateUserById(target.id, {
      ban_duration: target.status === 'nonaktif' ? '876000h' : 'none',
    })

    if (profileRollbackError || authRollback.error) {
      return {
        ok: false,
        error: 'Audit gagal dan status akun tidak dapat dipulihkan. Hubungi administrator.',
      }
    }
    return { ok: false, error: 'Perubahan status dibatalkan karena audit log gagal.' }
  }

  revalidatePath('/users')
  return {
    ok: true,
    message: validated.status === 'nonaktif' ? 'User dinonaktifkan.' : 'User diaktifkan kembali.',
  }
}
