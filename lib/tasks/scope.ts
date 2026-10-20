import type { SessionUser } from '@/lib/auth/session'
import type { Database } from '@/lib/supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

export function getVisibleTaskOrgUnitIds(
  user: SessionUser,
  orgUnits: readonly { id: number; parent_id: number | null }[],
): number[] {
  if (user.roleLevel >= 5) return orgUnits.map(({ id }) => id)
  if (user.roleLevel === 4) {
    return orgUnits
      .filter(({ id, parent_id }) => id === user.orgUnitId || parent_id === user.orgUnitId)
      .map(({ id }) => id)
  }
  if (user.roleLevel !== 1) return [user.orgUnitId]

  const visibleIds = new Set([user.orgUnitId])
  let parentIds = [user.orgUnitId]
  while (parentIds.length > 0) {
    parentIds = orgUnits
      .filter(({ parent_id }) => parentIds.includes(parent_id ?? -1))
      .map(({ id }) => id)
      .filter((id) => !visibleIds.has(id))
    parentIds.forEach((id) => visibleIds.add(id))
  }
  return [...visibleIds]
}

export async function getTaskScopeFilter(
  supabase: SupabaseClient<Database>,
  user: SessionUser,
): Promise<string | null> {
  if (user.roleLevel >= 5) return null

  const { data: orgUnits, error } = await supabase
    .from('org_units')
    .select('id, parent_id')

  if (error) throw new Error('Gagal memeriksa cakupan task.')

  const assignedUnitExists = orgUnits?.some(({ id }) => id === user.orgUnitId)
  if (!assignedUnitExists) throw new Error('Penempatan organisasi Anda belum dapat diverifikasi.')

  const orgUnitIds = getVisibleTaskOrgUnitIds(user, orgUnits ?? [])

  return [
    `org_unit_id.in.(${orgUnitIds.join(',')})`,
    `owner_id.eq.${user.id}`,
    `reviewer_id.eq.${user.id}`,
  ].join(',')
}
