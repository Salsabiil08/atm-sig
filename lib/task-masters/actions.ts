'use server'

// FR-100 / CR-0003 / NFR-001: mutasi master task hanya melalui action terautentikasi dan terscope.

import { revalidatePath } from 'next/cache'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import { ROLES } from '@/lib/constants/rbac'
import { createClient } from '@/lib/supabase/server'
import { getManageableOrgUnitIds } from '@/lib/users/scope'
import { isValidUuid } from '@/lib/tasks/validation'

export type MasterActionState = { ok: boolean; message: string }
const failure = (message: string): MasterActionState => ({ ok: false, message })
const success = (message: string): MasterActionState => ({ ok: true, message })

function field(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

async function getMasterContext(minimumRole: 'Staff/PIC' | 'Manager') {
  const user = await getSessionUser()
  requireRole(user, minimumRole)
  const supabase = await createClient()
  const orgUnitIds = user.roleLevel >= 4
    ? await getManageableOrgUnitIds(supabase, user)
    : [user.orgUnitId]
  return { user, supabase, orgUnitIds }
}

async function validSection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgUnitIds: number[],
  sectionId: number,
) {
  if (!orgUnitIds.includes(sectionId)) return false
  const { data, error } = await supabase.from('org_units').select('id, type').eq('id', sectionId).maybeSingle()
  return !error && data?.type === 'section'
}

export async function saveTaskCategory(
  _previous: MasterActionState,
  formData: FormData,
): Promise<MasterActionState> {
  const { supabase, orgUnitIds } = await getMasterContext(ROLES.MANAGER)
  const id = field(formData, 'id')
  const name = field(formData, 'name')
  const orgUnitId = Number(field(formData, 'org_unit_id'))
  const isActive = field(formData, 'is_active') !== 'false'

  if (!name || name.length > 80) return failure('Nama kategori wajib diisi dan maksimal 80 karakter.')
  if (id && !isValidUuid(id)) return failure('ID kategori tidak valid.')
  if (!Number.isInteger(orgUnitId) || !(await validSection(supabase, orgUnitIds, orgUnitId))) {
    return failure('Section kategori berada di luar cakupan Anda.')
  }

  if (id) {
    const { data: current, error } = await supabase.from('task_categories').select('org_unit_id').eq('id', id).maybeSingle()
    if (error || !current) return failure('Kategori tidak ditemukan atau berada di luar cakupan Anda.')
    if (current.org_unit_id !== orgUnitId) return failure('Section kategori tidak dapat dipindahkan setelah dibuat.')
  }

  const payload = { name, org_unit_id: orgUnitId, is_active: isActive }
  const result = id
    ? await supabase.from('task_categories').update(payload).eq('id', id).select('id').maybeSingle()
    : await supabase.from('task_categories').insert(payload).select('id').maybeSingle()

  if (result.error) {
    return failure(result.error.code === '23505'
      ? 'Kategori dengan nama tersebut sudah ada pada section ini.'
      : 'Kategori tidak dapat disimpan. Periksa kembali data dan cakupan Anda.')
  }
  if (!result.data) return failure('Kategori tidak ditemukan atau berada di luar cakupan Anda.')

  revalidatePath('/task-templates')
  return success(id ? 'Kategori berhasil diperbarui.' : 'Kategori berhasil dibuat.')
}

export async function deleteTaskCategory(
  _previous: MasterActionState,
  formData: FormData,
): Promise<MasterActionState> {
  const { supabase } = await getMasterContext(ROLES.MANAGER)
  const id = field(formData, 'id')
  if (!isValidUuid(id)) return failure('ID kategori tidak valid.')

  const { data, error } = await supabase.from('task_categories').delete().eq('id', id).select('id').maybeSingle()
  if (error) {
    return failure(error.code === '23503'
      ? 'Kategori masih dipakai task atau template. Nonaktifkan kategori jika tidak digunakan lagi.'
      : 'Kategori tidak dapat dihapus.')
  }
  if (!data) return failure('Kategori tidak ditemukan atau berada di luar cakupan Anda.')

  revalidatePath('/task-templates')
  return success('Kategori berhasil dihapus.')
}

async function getActiveProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
) {
  if (!isValidUuid(id)) return null
  const { data: profile, error } = await supabase
    .from('users').select('id, role_id, org_unit_id, supervisor_id, status').eq('id', id).maybeSingle()
  if (error || !profile || profile.status !== 'aktif') return null
  const { data: role, error: roleError } = await supabase.from('roles').select('level').eq('id', profile.role_id).maybeSingle()
  if (roleError || !role) return null
  return { ...profile, roleLevel: role.level }
}

export async function saveTaskTemplate(
  _previous: MasterActionState,
  formData: FormData,
): Promise<MasterActionState> {
  const { user, supabase, orgUnitIds } = await getMasterContext(ROLES.STAFF_PIC)
  const id = field(formData, 'id')
  const categoryId = field(formData, 'category_id')
  const orgUnitId = Number(field(formData, 'org_unit_id'))
  const name = field(formData, 'name')
  const title = field(formData, 'title')
  const priority = field(formData, 'priority')
  const ownerId = field(formData, 'owner_id')
  const reviewerField = field(formData, 'reviewer_id')
  const reviewerId = reviewerField || null
  const recurrence = field(formData, 'recurrence')
  const recurrenceDay = Number(field(formData, 'recurrence_day'))
  const startOffsetDays = Number(field(formData, 'start_offset_days'))
  const dueOffsetDays = Number(field(formData, 'due_offset_days'))

  if (id && !isValidUuid(id)) return failure('ID template tidak valid.')
  if (!isValidUuid(categoryId)) return failure('Kategori template tidak valid.')
  if (!name || name.length > 100 || !title || title.length > 200) {
    return failure('Nama template wajib diisi (maksimal 100 karakter) dan judul task maksimal 200 karakter.')
  }
  if (!['rendah', 'sedang', 'tinggi'].includes(priority)) return failure('Prioritas template tidak valid.')
  if (!['weekly', 'monthly'].includes(recurrence)) return failure('Frekuensi template tidak valid.')
  if (!Number.isInteger(recurrenceDay) || recurrenceDay < 1 || recurrenceDay > (recurrence === 'weekly' ? 7 : 31)) {
    return failure(recurrence === 'weekly' ? 'Hari mingguan harus 1 sampai 7.' : 'Tanggal bulanan harus 1 sampai 31.')
  }
  if (!Number.isInteger(startOffsetDays) || startOffsetDays < 0 || startOffsetDays > 365
    || !Number.isInteger(dueOffsetDays) || dueOffsetDays <= startOffsetDays || dueOffsetDays > 366) {
    return failure('Offset tenggat harus setelah offset mulai dan maksimal 366 hari.')
  }
  if (!(await validSection(supabase, orgUnitIds, orgUnitId))) {
    return failure('Section template berada di luar cakupan Anda.')
  }

  const { data: category, error: categoryError } = await supabase
    .from('task_categories').select('id').eq('id', categoryId).eq('org_unit_id', orgUnitId).eq('is_active', true).maybeSingle()
  if (categoryError || !category) return failure('Kategori harus aktif dan berada pada section yang sama.')

  const owner = await getActiveProfile(supabase, ownerId)
  if (!owner || owner.roleLevel < 2) return failure('PIC harus merupakan user aktif yang dapat menerima task.')
  if (user.roleLevel === 2 && owner.id !== user.id) return failure('PIC hanya dapat membuat tugas berulang untuk dirinya sendiri.')
  if (user.roleLevel < 5 && !orgUnitIds.includes(owner.org_unit_id)) {
    return failure('PIC berada di luar cakupan organisasi Anda.')
  }
  if (owner.roleLevel < 5 && owner.org_unit_id !== orgUnitId) {
    const { data: section } = await supabase.from('org_units').select('parent_id').eq('id', orgUnitId).maybeSingle()
    if (owner.roleLevel !== 4 || owner.org_unit_id !== section?.parent_id) {
      return failure('PIC harus berada pada section task atau menjadi SM unit induknya.')
    }
  }

  if (owner.roleLevel >= 5) {
    if (reviewerId) return failure('Task milik GM atau Super Admin tidak memiliki reviewer.')
  } else {
    const reviewer = reviewerId ? await getActiveProfile(supabase, reviewerId) : null
    if (!reviewer || owner.supervisor_id !== reviewer.id || reviewer.roleLevel !== owner.roleLevel + 1) {
      return failure('Reviewer harus merupakan atasan langsung aktif PIC dengan role satu tingkat di atas.')
    }
  }

  const payload = {
    org_unit_id: orgUnitId,
    category_id: categoryId,
    name,
    title,
    priority: priority as 'rendah' | 'sedang' | 'tinggi',
    owner_id: ownerId,
    reviewer_id: reviewerId,
    recurrence: recurrence as 'weekly' | 'monthly',
    recurrence_day: recurrenceDay,
    start_offset_days: startOffsetDays,
    due_offset_days: dueOffsetDays,
  }

  const result = id
    ? await supabase.from('task_templates').update(payload).eq('id', id).select('id').maybeSingle()
    : await supabase.from('task_templates').insert({ ...payload, created_by: user.id }).select('id').maybeSingle()
  if (result.error) return failure('Template tidak dapat disimpan. Periksa kembali penugasan dan cakupan organisasi.')
  if (!result.data) return failure('Template tidak ditemukan atau berada di luar cakupan Anda.')

  revalidatePath('/task-templates')
  return success(id ? 'Template berhasil diperbarui.' : 'Template berhasil dibuat.')
}

export async function toggleTaskTemplate(
  _previous: MasterActionState,
  formData: FormData,
): Promise<MasterActionState> {
  const { supabase } = await getMasterContext(ROLES.STAFF_PIC)
  const id = field(formData, 'id')
  const isActive = field(formData, 'is_active') === 'true'
  if (!isValidUuid(id)) return failure('ID template tidak valid.')

  const { data, error } = await supabase.from('task_templates').update({ is_active: isActive }).eq('id', id).select('id').maybeSingle()
  if (error) return failure('Status template tidak dapat diperbarui.')
  if (!data) return failure('Template tidak ditemukan atau berada di luar cakupan Anda.')

  revalidatePath('/task-templates')
  return success(isActive ? 'Jadwal template diaktifkan.' : 'Jadwal template dinonaktifkan.')
}

export async function deleteTaskTemplate(
  _previous: MasterActionState,
  formData: FormData,
): Promise<MasterActionState> {
  const { supabase } = await getMasterContext(ROLES.STAFF_PIC)
  const id = field(formData, 'id')
  if (!isValidUuid(id)) return failure('ID template tidak valid.')

  const { data, error } = await supabase.from('task_templates').delete().eq('id', id).select('id').maybeSingle()
  if (error) {
    return failure(error.code === '23503'
      ? 'Template sudah memiliki riwayat eksekusi. Nonaktifkan jadwal agar histori tetap utuh.'
      : 'Template tidak dapat dihapus.')
  }
  if (!data) return failure('Template tidak ditemukan atau berada di luar cakupan Anda.')

  revalidatePath('/task-templates')
  return success('Template berhasil dihapus.')
}
