'use server'

// FR-020, FR-021, FR-022, FR-028, FR-029 — Server Actions untuk CRUD task
// NFR-001: setiap action wajib memanggil getSessionUser() dan requireRole()
// PR-1: hak akses dicek di sisi server, bukan hanya UI

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import { ROLES } from '@/lib/constants/rbac'
import { TASK_STATUSES, type TaskStatus } from '@/lib/constants/rbac'
import type { Database } from '@/lib/supabase/database.types'
import { AdminConfigurationError, createAdminClient } from '@/lib/supabase/admin'
import {
  isValidUuid,
  validateEvidenceRequirements,
  validateTaskDetails,
  type EvidenceRequirementInput,
  type TaskDetailsInput,
} from './validation'
import { isAllowedTaskStatusTransition } from './status'
import { isValidTaskReviewer } from './reviewer'
import { isReminderResponse } from '@/lib/reminders/responses'

// ============== TIPE INPUT ==============

export type CreateTaskInput = TaskDetailsInput & {
  categoryId?: string | null
  evidenceRequirements?: EvidenceRequirementInput[]
  wbsItems?: { title:string; weight:number; parentIndex:number|null }[]
  initialSupport?: { neededFromId:string; description:string }[]
}

export type UpdateTaskInput = TaskDetailsInput & {
  taskId: string
}

export type UpdateTaskStartDateInput = {
  taskId: string
  startDate: string
}

export type ReassignTaskInput = {
  taskId: string
  newOwnerId: string
  reason: string
}

export type UpdateStatusInput = {
  taskId: string
  status: TaskStatus
}

export type ReviewTaskInput = {
  taskId: string
  decision: 'Done' | 'Revisi'
  comment?: string
}

export type UpdateTaskProgressInput = {
  taskId: string
  progressPct: number
}

export type RespondToReminderInput = {
  reminderId: string
  response: string
}

export type AddCommentInput = {
  taskId: string
  body: string
}

export type AddSupportInput = {
  taskId: string
  neededFromId: string
  description: string
}

export type ProvideSupportInput = {
  supportId: string
}

export type AddEvidenceLinkInput = {
  requirementId: string
  link: string
}

export type UploadTaskEvidenceInput = {
  requirementId: string
  file: File
}

export type RequestDeadlineChangeInput = {
  taskId: string
  newDueDate: string
  reason: string
}

export type ApproveDeadlineInput = {
  requestId: string
  decision: 'Disetujui' | 'Ditolak'
}

const EVIDENCE_BUCKET = 'task-evidence'
const MAX_EVIDENCE_FILE_SIZE = 20 * 1024 * 1024
const EVIDENCE_FILE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'text/csv': 'csv',
}

async function hasValidEvidenceContent(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())

  if (file.type === 'application/pdf') {
    return new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-'
  }
  if (file.type === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (file.type === 'image/png') {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (byte, index) => bytes[index] === byte,
    )
  }

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return false
  }
  return !bytes.some((byte) => byte === 0x7f || (byte < 0x20 && ![0x09, 0x0a, 0x0d].includes(byte)))
}

// ============== HELPER: catat audit log ==============

async function writeAuditLog(
  userId: string,
  action: string,
  object: string,
  oldValue?: string | null,
  newValue?: string | null,
) {
  const admin = createAdminClient()
  const { error } = await admin.from('audit_logs').insert({
    user_id: userId,
    action,
    object,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
  })
  if (error) throw new Error('Gagal mencatat audit log task.')
}

async function validateReviewerAssignment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  reviewerId: string | null,
): Promise<string | null> {
  const userIds = reviewerId ? [ownerId, reviewerId] : [ownerId]
  const { data: profiles, error: profilesError } = await supabase
    .from('users')
    .select('id, role_id, supervisor_id, status')
    .in('id', userIds)

  if (profilesError) return 'Gagal memeriksa PIC dan reviewer task.'
  const ownerProfile = profiles?.find((profile) => profile.id === ownerId)
  const reviewerProfile = reviewerId
    ? profiles?.find((profile) => profile.id === reviewerId)
    : null
  if (!ownerProfile || ownerProfile.status !== 'aktif') {
    return 'PIC task harus merupakan user aktif.'
  }
  if (reviewerId && (!reviewerProfile || reviewerProfile.status !== 'aktif')) {
    return 'Reviewer task harus merupakan atasan aktif PIC.'
  }

  const roleIds = [...new Set([
    ownerProfile.role_id,
    ...(reviewerProfile ? [reviewerProfile.role_id] : []),
  ])]
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, level')
    .in('id', roleIds)
  if (rolesError) return 'Gagal memeriksa role PIC dan reviewer task.'

  const roleLevels = new Map((roles ?? []).map(({ id, level }) => [id, level]))
  const ownerRoleLevel = roleLevels.get(ownerProfile.role_id)
  const reviewerRoleLevel = reviewerProfile
    ? roleLevels.get(reviewerProfile.role_id)
    : undefined
  if (ownerRoleLevel === undefined || (reviewerProfile && reviewerRoleLevel === undefined)) {
    return 'Role PIC atau reviewer task tidak valid.'
  }

  const valid = isValidTaskReviewer(
    {
      id: ownerProfile.id,
      roleLevel: ownerRoleLevel,
      supervisorId: ownerProfile.supervisor_id,
      active: ownerProfile.status === 'aktif',
    },
    reviewerProfile
      ? {
          id: reviewerProfile.id,
          roleLevel: reviewerRoleLevel ?? 0,
          supervisorId: reviewerProfile.supervisor_id,
          active: reviewerProfile.status === 'aktif',
        }
      : null,
  )

  if (!valid) {
    return ownerRoleLevel >= 5
      ? 'Task milik GM atau Super Admin tidak boleh memiliki reviewer.'
      : 'Reviewer harus atasan langsung PIC dengan role sesuai rantai review.'
  }

  return null
}

// ============== CREATE TASK ==============

/**
 * FR-020 — Buat task baru.
 * PIC (2) boleh membuat task untuk dirinya sendiri; Manager+ mengikuti scope.
 */
export async function createTask(input: CreateTaskInput) {
  const user = await getSessionUser()
  requireRole(user, ROLES.STAFF_PIC)

  const validation = validateTaskDetails(input)
  if (!validation.ok) return { error: validation.error }
  const task = validation.data
  if (user.roleLevel === 2 && (
    task.ownerId !== user.id || task.orgUnitId !== user.orgUnitId ||
    task.reviewerId !== user.supervisorId || !task.reviewerId || task.parentTaskId !== null
  )) return { error: 'PIC hanya dapat membuat task pribadi dalam section sendiri dengan reviewer atasan langsung.' }
  const evidenceValidation = validateEvidenceRequirements(input.evidenceRequirements)
  if (!evidenceValidation.ok) return { error: evidenceValidation.error }

  const supabase = await createClient()
  const reviewerError = await validateReviewerAssignment(
    supabase,
    task.ownerId,
    task.reviewerId,
  )
  if (reviewerError) return { error: reviewerError }

  if (input.categoryId) {
    if (!isValidUuid(input.categoryId)) return { error: 'Kategori task tidak valid.' }
    const { data: category, error: categoryError } = await supabase.from('task_categories')
      .select('id,org_unit_id,is_active').eq('id',input.categoryId).maybeSingle()
    if (categoryError || !category?.is_active) return { error: 'Kategori tidak tersedia.' }
    const { data: section, error: sectionError } = await supabase.from('org_units')
      .select('parent_id').eq('id', task.orgUnitId).maybeSingle()
    if (sectionError || !section || (category.org_unit_id !== task.orgUnitId && category.org_unit_id !== section.parent_id)) {
      return { error: 'Kategori tidak berada dalam cakupan section task.' }
    }
  }

  // Transaction bundle includes task, evidence, WBS and PIC support. The
  // function is SECURITY INVOKER, so existing table RLS remains mandatory.
  if (input.wbsItems?.length || input.initialSupport?.length) {
    const { data: newId, error: bundleError } = await supabase.rpc('create_task_bundle_r03', {
      p_owner_id: task.ownerId,
      p_reviewer_id: task.reviewerId,
      p_org_unit_id: task.orgUnitId,
      p_parent_task_id: task.parentTaskId,
      p_title: task.title,
      p_priority: task.priority,
      p_start_date: task.startDate,
      p_due_date: task.dueDate,
      p_category_id: input.categoryId ?? null,
      p_evidence: evidenceValidation.data,
      p_wbs: input.wbsItems ?? [],
      p_support: input.initialSupport ?? [],
    })
    if (bundleError || !newId) return { error: 'Gagal membuat task beserta WBS/support. Semua perubahan dibatalkan.' }
    revalidatePath('/tasks')
    revalidatePath('/dashboard')
    return { data: { id: newId } }
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      owner_id: task.ownerId,
      assigner_id: user.id,
      reviewer_id: task.reviewerId,
      org_unit_id: task.orgUnitId,
      parent_task_id: task.parentTaskId,
      ...(input.categoryId ? { category_id: input.categoryId } : {}),
      title: task.title,
      priority: task.priority,
      start_date: task.startDate,
      due_date: task.dueDate,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: 'Gagal membuat task. Silakan coba lagi.' }
  }

  if (evidenceValidation.data.length > 0) {
    const { error: evidenceError } = await supabase.from('evidence_requirements').insert(
      evidenceValidation.data.map((requirement) => ({
        task_id: data.id,
        description: requirement.description,
        mandatory: requirement.mandatory,
      })),
    )

    if (evidenceError) {
      const { error: rollbackError } = await supabase.from('tasks').delete().eq('id', data.id)
      return {
        error: rollbackError
          ? 'Task tersimpan, tetapi persyaratan evidence gagal disimpan dan task tidak dapat dibatalkan.'
          : 'Gagal menyimpan persyaratan evidence; task telah dibatalkan.',
      }
    }
  }

  revalidatePath('/tasks')
  revalidatePath('/dashboard')

  return { data: { id: data.id } }
}

export async function updateTask(input: UpdateTaskInput) {
  const user = await getSessionUser()
  requireRole(user, ROLES.MANAGER)
  if (!isValidUuid(input.taskId)) return { error: 'ID task tidak valid.' }

  const validation = validateTaskDetails(input)
  if (!validation.ok) return { error: validation.error }
  const task = validation.data
  const supabase = await createClient()

  const { data: previousTask, error: readError } = await supabase
    .from('tasks')
    .select('id, title, owner_id, reviewer_id, org_unit_id, parent_task_id, priority, start_date, due_date')
    .eq('id', input.taskId)
    .maybeSingle()

  if (readError) return { error: 'Gagal memeriksa task sebelum diperbarui.' }
  if (!previousTask) return { error: 'Task tidak ditemukan atau berada di luar cakupan Anda.' }
  if (previousTask.owner_id !== task.ownerId) {
    return { error: 'Gunakan aksi pindah task untuk mengganti PIC.' }
  }
  const reviewerError = await validateReviewerAssignment(
    supabase,
    task.ownerId,
    task.reviewerId,
  )
  if (reviewerError) return { error: reviewerError }

  const { data: updatedTask, error } = await supabase
    .from('tasks')
    .update({
      title: task.title,
      owner_id: task.ownerId,
      reviewer_id: task.reviewerId,
      org_unit_id: task.orgUnitId,
      parent_task_id: task.parentTaskId,
      priority: task.priority,
      start_date: task.startDate,
      due_date: task.dueDate,
    })
    .eq('id', input.taskId)
    .select('id')
    .maybeSingle()

  if (error) return { error: 'Gagal memperbarui task.' }
  if (!updatedTask) return { error: 'Akses ditolak: task berada di luar cakupan Anda.' }

  revalidatePath(`/tasks/${input.taskId}`)
  revalidatePath('/tasks')
  revalidatePath('/kanban')
  revalidatePath('/timeline')
  revalidatePath('/dashboard')

  return { data: { success: true } }
}

// FR-111 / BR-081: direct start-date changes are limited to scoped Manager+ users.
export async function updateTaskStartDate(input: UpdateTaskStartDateInput) {
  const user = await getSessionUser()
  requireRole(user, ROLES.MANAGER)
  if (!input || !isValidUuid(input.taskId) || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    return { error: 'Tanggal mulai task tidak valid.' }
  }
  const parsedDate = new Date(`${input.startDate}T00:00:00.000Z`)
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== input.startDate) {
    return { error: 'Tanggal mulai task tidak valid.' }
