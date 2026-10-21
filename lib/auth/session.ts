// NFR-001, PR-1 — Server-side RBAC helper
// Setiap Server Action dan Route Handler WAJIB memanggil fungsi ini sebelum melakukan operasi apapun.

import { createClient } from '@/lib/supabase/server'
import { ROLE_LEVELS, type RoleName } from '@/lib/constants/rbac'
import { redirect } from 'next/navigation'
import { cache } from 'react'

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
 * Dimemoize per request (React cache): layout, halaman, dan fungsi query yang
 * memanggilnya dalam satu request hanya memicu satu pemeriksaan auth + satu
 * query profil. Profil dan role diambil dalam satu query (relasi users -> roles).
 *
 * Gunakan di Server Component:
 *   const user = await getSessionUser()
 */
export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, name, email, org_unit_id, supervisor_id, role:roles!users_role_id_fkey ( name, level )')
    .eq('id', user.id)
    .eq('status', 'aktif')
    .single()

  if (profileError || !profile || !profile.role) {
    // User ada di auth tapi belum ada profil/role yang valid — kembali ke login
    redirect('/login')
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role.name as RoleName,
    roleLevel: profile.role.level,
    orgUnitId: profile.org_unit_id,
    supervisorId: profile.supervisor_id,
  }
})

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
