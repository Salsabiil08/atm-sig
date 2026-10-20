// NFR-001, PR-1 — Server-side RBAC helper
// Setiap Server Action dan Route Handler WAJIB memanggil fungsi ini sebelum melakukan operasi apapun.

import { createClient } from '@/lib/supabase/server'
import { ROLE_LEVELS, type RoleName } from '@/lib/constants/rbac'
import { redirect } from 'next/navigation'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: RoleName
  roleLevel: number
  orgUnitId: number
  supervisorId: string | null
}

/**
 * Mengambil user yang sedang login beserta data role dan org_unit.
 * Jika tidak ada sesi aktif, redirect ke /login.
 *
 * Gunakan di Server Component:
 *   const user = await getSessionUser()
 */
export async function getSessionUser(): Promise<SessionUser> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, name, email, role_id, org_unit_id, supervisor_id')
    .eq('id', user.id)
    .eq('status', 'aktif')
    .single()

  if (profileError || !profile) {
    // User ada di auth tapi belum ada profil — arahkan ke halaman setup atau login
    redirect('/login')
  }

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('name, level')
    .eq('id', profile.role_id)
    .single()

  if (roleError || !role) {
    redirect('/login')
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: role.name as RoleName,
    roleLevel: role.level,
    orgUnitId: profile.org_unit_id,
    supervisorId: profile.supervisor_id,
  }
}

/**
 * Guard: memastikan user memiliki level role minimum.
 * Lempar error jika tidak memenuhi syarat.
 *
 * Contoh: requireRole(user, 'SM') — hanya SM, GM, Super Admin yang lolos.
 */
export function requireRole(user: SessionUser, minimumRole: RoleName): void {
  const minimumLevel = ROLE_LEVELS[minimumRole]
  if (user.roleLevel < minimumLevel) {
    throw new Error(`Akses ditolak: membutuhkan role ${minimumRole} atau lebih tinggi`)
  }
}

/**
 * Guard: memastikan user berada di org_unit tertentu atau memiliki akses lintas unit.
 * GM dan Super Admin selalu lolos (akses semua unit).
 */
export function requireSameUnit(user: SessionUser, targetOrgUnitId: number): void {
  // GM (level 5) dan Super Admin (level 6) punya akses ke seluruh departemen
  if (user.roleLevel >= ROLE_LEVELS['GM']) return

  if (user.orgUnitId !== targetOrgUnitId) {
    throw new Error('Akses ditolak: data berada di luar cakupan unit Anda')
  }
}
