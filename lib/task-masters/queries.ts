// FR-100 / D-032: data master kategori dan template hanya untuk SM+ sesuai cakupan.

import type { SessionUser } from '@/lib/auth/session'
import { ROLE_LEVELS } from '@/lib/constants/rbac'
import { createClient } from '@/lib/supabase/server'
import { getManageableOrgUnitIds } from '@/lib/users/scope'
import { getVisibleTaskOrgUnitIds } from '@/lib/tasks/scope'

export type MasterSection = {
  id: number
  name: string
  unitName: string
  parentId: number | null
}

export type MasterPerson = {
  id: string
  name: string
  roleLevel: number
  orgUnitId: number
  supervisorId: string | null
}

export type TaskCategory = {
  id: string
  orgUnitId: number
  name: string
  isActive: boolean
}

export type TaskTemplate = {
  id: string
  orgUnitId: number
  categoryId: string
  name: string
  title: string
  priority: 'rendah' | 'sedang' | 'tinggi'
  ownerId: string
  reviewerId: string | null
  recurrence: 'weekly' | 'monthly'
  recurrenceDay: number
  startOffsetDays: number
  dueOffsetDays: number
  isActive: boolean
  nextRunAt: string
}

export type TaskMasterData = {
  canAssignGlobalOwner: boolean
  canManageCategories: boolean
  ownerSelectionUserId: string | null
  sections: MasterSection[]
  people: MasterPerson[]
  categories: TaskCategory[]
  templates: TaskTemplate[]
}

export async function getTaskMasterData(user: SessionUser): Promise<TaskMasterData> {
  if (user.roleLevel < ROLE_LEVELS['Staff/PIC']) {
    throw new Error('Role Anda tidak dapat mengakses master task.')
  }

  const supabase = await createClient()
  const unitsResult = await supabase.from('org_units').select('id, parent_id, name, type').order('name')
  if (unitsResult.error) throw new Error('Gagal memuat struktur organisasi master task.')
  const units = unitsResult.data ?? []
  const manageableIds = user.roleLevel >= ROLE_LEVELS.SM
    ? await getManageableOrgUnitIds(supabase, user)
    : getVisibleTaskOrgUnitIds(user, units)
  if (!manageableIds.length) return {
    canAssignGlobalOwner: user.roleLevel >= ROLE_LEVELS.GM,
    canManageCategories: user.roleLevel >= ROLE_LEVELS.Manager,
    ownerSelectionUserId: user.roleLevel === ROLE_LEVELS['Staff/PIC'] ? user.id : null,
    sections: [], people: [], categories: [], templates: [],
  }
  const [usersResult, categoriesResult] = await Promise.all([
    supabase.from('users').select('id, name, role_id, org_unit_id, supervisor_id, status').eq('status', 'aktif').order('name'),
    supabase.from('task_categories').select('id, org_unit_id, name, is_active').in('org_unit_id', manageableIds).order('name'),
  ])

  if (usersResult.error || categoriesResult.error) {
    throw new Error('Gagal memuat master kategori dan template task.')
  }

  const sections = units
    .filter((unit) => unit.type === 'section' && manageableIds.includes(unit.id))
    .map((section) => ({
      id: section.id,
      name: section.name,
      parentId: section.parent_id,
      unitName: units.find((unit) => unit.id === section.parent_id)?.name ?? 'Unit',
    }))

  const roleIds = [...new Set((usersResult.data ?? []).map((profile) => profile.role_id))]
  const sectionIds = sections.map(({ id }) => id)

  // Lookup role dan template saling independen (masing-masing hanya butuh hasil
  // query sebelumnya) — jalankan paralel.
  const [rolesResult, templatesResult] = await Promise.all([
    roleIds.length
      ? supabase.from('roles').select('id, level').in('id', roleIds)
      : Promise.resolve({ data: [], error: null }),
    sectionIds.length
      ? supabase.from('task_templates')
          .select('id, org_unit_id, category_id, name, title, priority, owner_id, reviewer_id, recurrence, recurrence_day, start_offset_days, due_offset_days, is_active, next_run_at')
          .in('org_unit_id', sectionIds)
          .order('name')
      : Promise.resolve({ data: [], error: null }),
  ])

  const { data: roles, error: rolesError } = rolesResult
  if (rolesError) throw new Error('Gagal memuat role pengguna.')
  const roleLevels = new Map((roles ?? []).map((role) => [role.id, role.level]))
  const people = (usersResult.data ?? []).flatMap((profile) => {
    const roleLevel = roleLevels.get(profile.role_id)
    const visibleToPic = user.roleLevel !== 2 || profile.id === user.id || profile.id === user.supervisorId
    const visibleToManager = user.roleLevel !== 3 || manageableIds.includes(profile.org_unit_id) || profile.id === user.supervisorId
    return roleLevel && roleLevel >= ROLE_LEVELS['Staff/PIC'] && visibleToPic && visibleToManager
      ? [{
          id: profile.id,
          name: profile.name,
          roleLevel,
          orgUnitId: profile.org_unit_id,
          supervisorId: profile.supervisor_id,
        }]
      : []
  })

  const { data: templateRows, error: templatesError } = templatesResult
  if (templatesError) throw new Error('Gagal memuat template task.')

  return {
    canAssignGlobalOwner: user.roleLevel >= ROLE_LEVELS.GM,
    canManageCategories: user.roleLevel >= ROLE_LEVELS.Manager,
    ownerSelectionUserId: user.roleLevel === ROLE_LEVELS['Staff/PIC'] ? user.id : null,
    sections,
    people,
    categories: (categoriesResult.data ?? []).map((category) => ({
      id: category.id,
      orgUnitId: category.org_unit_id,
      name: category.name,
      isActive: category.is_active,
    })),
    templates: (templateRows ?? []).map((template) => ({
      id: template.id,
      orgUnitId: template.org_unit_id,
      categoryId: template.category_id,
      name: template.name,
      title: template.title,
      priority: template.priority,
      ownerId: template.owner_id,
      reviewerId: template.reviewer_id,
      recurrence: template.recurrence,
      recurrenceDay: template.recurrence_day,
      startOffsetDays: template.start_offset_days,
      dueOffsetDays: template.due_offset_days,
      isActive: template.is_active,
      nextRunAt: template.next_run_at,
    })),
  }
}
