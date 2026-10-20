import { ROLE_LEVELS, ROLES } from '@/lib/constants/rbac'
import type { SessionUser } from '@/lib/auth/session'
import type { Database } from '@/lib/supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canManageUser, manageableOrgUnitIds } from './permissions'

type UserClient = SupabaseClient<Database>

export async function getManageableOrgUnitIds(
  supabase: UserClient,
  user: SessionUser,
): Promise<number[]> {
  if (user.roleLevel < ROLE_LEVELS.SM) return []

  const { data: orgUnits, error } = await supabase
    .from('org_units')
    .select('id, parent_id')

  if (error) throw new Error('Gagal memeriksa cakupan unit user.')

  const ids = manageableOrgUnitIds(
    user,
    (orgUnits ?? []).map(({ id, parent_id }) => ({ id, parentId: parent_id })),
  )
  if (user.role === ROLES.SM && !ids.includes(user.orgUnitId)) {
    throw new Error('Penempatan unit Anda belum dapat diverifikasi.')
  }

  return ids
}

export async function canManageTargetUser(
  supabase: UserClient,
  actor: SessionUser,
  target: { id: string; role: Parameters<typeof canManageUser>[1]['role']; orgUnitId: number },
): Promise<boolean> {
  if (actor.roleLevel < ROLE_LEVELS.SM) return false
  const orgUnitIds = await getManageableOrgUnitIds(supabase, actor)
  return canManageUser(actor, target, orgUnitIds)
}
