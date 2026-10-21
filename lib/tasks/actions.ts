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
  evidenceRequirements?: EvidenceRequirementInput[]
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

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      owner_id: task.ownerId,
      assigner_id: user.id,
      reviewer_id: task.reviewerId,
      org_unit_id: task.orgUnitId,
      parent_task_id: task.parentTaskId,
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

  await writeAuditLog(user.id, 'create', `tasks:${data.id}`, null, task.title)
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

  await writeAuditLog(
    user.id,
    'update',
    `tasks:${input.taskId}`,
    JSON.stringify(previousTask),
    JSON.stringify(task),
  )
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
  }

  const supabase = await createClient()
  const { data: updatedTask, error } = await supabase
    .from('tasks')
    .update({ start_date: input.startDate })
    .eq('id', input.taskId)
    .select('id')
    .maybeSingle()

  if (error) return { error: 'Gagal memperbarui tanggal mulai. Pastikan tanggal sebelum tenggat dan task berada dalam cakupan Anda.' }
  if (!updatedTask) return { error: 'Task tidak ditemukan atau berada di luar cakupan Anda.' }

  revalidatePath(`/tasks/${input.taskId}`)
  revalidatePath('/tasks')
  revalidatePath('/kanban')
  revalidatePath('/timeline')
  revalidatePath('/dashboard')
  return { data: { success: true } }
}

export async function deleteTask(taskId: string) {
  const user = await getSessionUser()
  requireRole(user, ROLES.MANAGER)
  if (!isValidUuid(taskId)) return { error: 'ID task tidak valid.' }

  const supabase = await createClient()
  const { data: task, error: readError } = await supabase
    .from('tasks')
    .select('id, title')
    .eq('id', taskId)
    .maybeSingle()

  if (readError) return { error: 'Gagal memeriksa task sebelum dihapus.' }
  if (!task) return { error: 'Task tidak ditemukan atau berada di luar cakupan Anda.' }

  const { data: deletedTask, error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .select('id')
    .maybeSingle()

  if (error) {
    return { error: 'Gagal menghapus task. Pastikan tidak ada subtask yang masih terhubung.' }
  }
  if (!deletedTask) return { error: 'Akses ditolak: task berada di luar cakupan Anda.' }

  await writeAuditLog(user.id, 'delete', `tasks:${taskId}`, task.title, null)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')

  return { data: { success: true } }
}

export async function reassignTask(input: ReassignTaskInput) {
  await getSessionUser()
  if (
    !input ||
    !isValidUuid(input.taskId) ||
    !isValidUuid(input.newOwnerId) ||
    typeof input.reason !== 'string' ||
    !input.reason.trim()
  ) {
    return { error: 'Task, PIC tujuan, dan alasan pemindahan wajib diisi dengan benar.' }
  }

  const supabase = await createClient()
  const { data: reassignmentId, error } = await supabase.rpc('reassign_task', {
    p_task_id: input.taskId,
    p_new_owner_id: input.newOwnerId,
    p_reason: input.reason.trim(),
  })

  if (error || !reassignmentId) {
    return { error: 'Pemindahan task ditolak atau gagal. Periksa cakupan, PIC tujuan, dan alasannya.' }
  }

  revalidatePath(`/tasks/${input.taskId}`)
  revalidatePath('/tasks')
  revalidatePath('/notifications')
  return { data: { reassignmentId } }
}

// T-507 / FR-110 / BR-080: authorized task managers may make ordinary moves;
// review decisions still use the dedicated reviewer action.
// ============== UPDATE STATUS ==============

/**
 * FR-026 — Update task status through the BR-001 state machine.
 */
export async function updateTaskStatus(input: UpdateStatusInput) {
  const user = await getSessionUser()
  if (!input || !isValidUuid(input.taskId)) return { error: 'ID task tidak valid.' }
  if (!TASK_STATUSES.includes(input.status)) return { error: 'Status task tidak valid.' }

  const supabase = await createClient()

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, status, owner_id, reviewer_id, org_unit_id')
    .eq('id', input.taskId)
    .maybeSingle()

  if (taskError) return { error: 'Gagal memeriksa task sebelum mengubah status.' }
  if (!task) return { error: 'Task tidak ditemukan atau berada di luar cakupan Anda.' }

  const isOwner = task.owner_id === user.id
  const isReviewer = task.reviewer_id === user.id
  // RLS has already constrained this task to the user's readable scope;
  // Managers and above may move it through ordinary BR-001 transitions.
  const canManageTask = user.roleLevel >= 3
  if (isReviewer && input.status === 'Revisi') {
    return { error: 'Gunakan aksi review dan isi komentar penolakan.' }
  }
  if (!isOwner && !isReviewer && !canManageTask) {
    return { error: 'Akses ditolak: role Anda tidak dapat memindahkan task.' }
  }
  if (
    !isAllowedTaskStatusTransition(task.status, input.status, {
      isOwner,
      isReviewer,
      canManageTask,
      ownerRoleLevel: user.roleLevel,
    })
  ) {
    return { error: `Transisi status ${task.status} ke ${input.status} tidak diizinkan.` }
  }

  if (input.status === 'Blocked' || (task.status === 'Blocked' && input.status === 'In progress')) {
    const { data: pendingSupport, error: supportError } = await supabase
      .from('task_supports')
      .select('id')
      .eq('task_id', input.taskId)
      .eq('status', 'diminta')
      .limit(1)
      .maybeSingle()

    if (supportError) return { error: 'Gagal memeriksa permintaan support task.' }
    if (input.status === 'Blocked' && !pendingSupport) {
      return { error: 'Task hanya dapat berstatus Blocked jika memiliki support yang masih diminta.' }
    }
    if (task.status === 'Blocked' && input.status === 'In progress' && pendingSupport) {
      return { error: 'Support task harus diberikan sebelum kembali ke In progress.' }
    }
  }

  const isExemptOwnerCompletion = isOwner && user.roleLevel >= 5
  if ((input.status === 'Review' || input.status === 'Done') && !isExemptOwnerCompletion) {
    const { data: requirements, error: evidenceError } = await supabase
      .from('evidence_requirements')
      .select('id, task_evidence(id)')
      .eq('task_id', input.taskId)
      .eq('mandatory', true)

    if (evidenceError) return { error: 'Gagal memeriksa evidence wajib task.' }
    const missingEvidence = (requirements ?? []).some(
      (requirement) => requirement.task_evidence.length === 0,
    )
    if (missingEvidence) {
      return { error: 'Semua evidence wajib harus diunggah sebelum mengirim task ke Review atau Done.' }
    }
  }

  const oldStatus = task.status
  const completedAt = input.status === 'Done' ? new Date().toISOString() : null

  const updateData: Database['public']['Tables']['tasks']['Update'] = {
    status: input.status,
  }
  if (input.status === 'Done') updateData.completed_at = completedAt

  const { data: updatedTask, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', input.taskId)
    .select('id')
    .maybeSingle()

  if (error) return { error: 'Gagal memperbarui status task.' }
  if (!updatedTask) return { error: 'Akses ditolak: task berada di luar cakupan Anda.' }

  await writeAuditLog(user.id, 'update_status', `tasks:${input.taskId}`, oldStatus, input.status)
  revalidatePath(`/tasks/${input.taskId}`)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath('/kanban')
  revalidatePath('/timeline')

  return { data: { success: true } }
}

export async function reviewTask(input: ReviewTaskInput) {
  const user = await getSessionUser()
  if (!input || !isValidUuid(input.taskId)) return { error: 'ID task tidak valid.' }
  if (input.decision !== 'Done' && input.decision !== 'Revisi') {
    return { error: 'Keputusan review tidak valid.' }
  }

  const comment = typeof input.comment === 'string' ? input.comment.trim() : ''
  if (input.decision === 'Revisi' && !comment) {
    return { error: 'Komentar wajib diisi untuk menolak task.' }
  }
  if (comment.length > 5000) {
    return { error: 'Komentar maksimal 5000 karakter.' }
  }

  const supabase = await createClient()
  const { data: reviewedTask, error } = await supabase.rpc('review_task', {
    p_task_id: input.taskId,
    p_decision: input.decision,
    p_comment: comment || null,
  })

  if (error || !reviewedTask) {
    return { error: 'Review ditolak atau gagal. Pastikan Anda reviewer task dan task berstatus Review.' }
  }

  await writeAuditLog(user.id, 'review_task', `tasks:${input.taskId}`, 'Review', input.decision)
  revalidatePath(`/tasks/${input.taskId}`)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath('/approvals')
  return { data: { success: true } }
}

export async function updateTaskProgress(input: UpdateTaskProgressInput) {
  const user = await getSessionUser()
  if (!input || !isValidUuid(input.taskId)) {
    return { error: 'ID task tidak valid.' }
  }
  if (!Number.isInteger(input.progressPct) || input.progressPct < 0 || input.progressPct > 100) {
    return { error: 'Progress harus berupa bilangan bulat dari 0 sampai 100.' }
  }

  const supabase = await createClient()
  const { data: task, error: readError } = await supabase
    .from('tasks')
    .select('id, owner_id')
    .eq('id', input.taskId)
    .maybeSingle()

  if (readError) return { error: 'Gagal memeriksa task sebelum memperbarui progress.' }
  if (!task) return { error: 'Task tidak ditemukan atau berada di luar cakupan Anda.' }
  if (task.owner_id !== user.id) {
    return { error: 'Hanya PIC task yang dapat memperbarui progress.' }
  }

  const { data: updatedTask, error } = await supabase
    .from('tasks')
    .update({ progress_pct: input.progressPct })
    .eq('id', input.taskId)
    .select('id')
    .maybeSingle()

  if (error) return { error: 'Gagal memperbarui progress task.' }
  if (!updatedTask) return { error: 'Akses ditolak: task berada di luar cakupan Anda.' }

  revalidatePath(`/tasks/${input.taskId}`)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  return { data: { success: true } }
}

export async function respondToReminder(input: RespondToReminderInput) {
  const user = await getSessionUser()
  if (!input || !isValidUuid(input.reminderId)) {
    return { error: 'ID reminder tidak valid.' }
  }
  if (!isReminderResponse(input.response)) {
    return { error: 'Pilih tanggapan reminder yang tersedia.' }
  }

  const supabase = await createClient()
  const { data: reminder, error: reminderError } = await supabase
    .from('task_reminders')
    .select('id, task_id, response')
    .eq('id', input.reminderId)
    .maybeSingle()

  if (reminderError) return { error: 'Gagal memeriksa reminder.' }
  if (!reminder) return { error: 'Reminder tidak ditemukan atau di luar cakupan Anda.' }
  if (reminder.response !== null) return { error: 'Reminder ini sudah ditanggapi.' }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, owner_id')
    .eq('id', reminder.task_id)
    .maybeSingle()

  if (taskError) return { error: 'Gagal memeriksa PIC task.' }
  if (!task || task.owner_id !== user.id) {
    return { error: 'Hanya PIC task yang dapat menanggapi reminder.' }
  }

  const { data: updatedReminder, error } = await supabase
    .from('task_reminders')
    .update({ response: input.response })
    .eq('id', input.reminderId)
    .is('response', null)
    .select('id')
    .maybeSingle()

  if (error) return { error: 'Gagal menyimpan tanggapan reminder.' }
  if (!updatedReminder) return { error: 'Reminder ini sudah ditanggapi.' }

  revalidatePath('/notifications')
  revalidatePath(`/tasks/${reminder.task_id}`)
  return { data: { success: true } }
}

// ============== ADD COMMENT ==============

/**
 * FR-035 — Tambah komentar pada task.
 */
export async function addComment(input: AddCommentInput) {
  const user = await getSessionUser()

  if (!input.body.trim()) {
    return { error: 'Komentar tidak boleh kosong.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('task_comments').insert({
    task_id: input.taskId,
    user_id: user.id,
    body: input.body.trim(),
  })

  if (error) return { error: 'Gagal menambahkan komentar.' }

  revalidatePath(`/tasks/${input.taskId}`)
  return { data: { success: true } }
}

// ============== ADD SUPPORT REQUEST ==============

/**
 * FR-022 — PIC task dapat meminta bantuan (support) dari user lain.
 */
export async function addSupportRequest(input: AddSupportInput) {
  const user = await getSessionUser()
  if (
    !isValidUuid(input.taskId) ||
    !isValidUuid(input.neededFromId) ||
    input.neededFromId === user.id
  ) {
    return { error: 'Data permintaan support tidak valid.' }
  }
  const description = input.description.trim()
  if (!description) return { error: 'Jelaskan support yang dibutuhkan.' }

  const supabase = await createClient()

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('owner_id')
    .eq('id', input.taskId)
    .maybeSingle()

  if (taskError) return { error: 'Gagal memeriksa task untuk permintaan support.' }
  if (!task) return { error: 'Task tidak ditemukan atau berada di luar cakupan Anda.' }
  if (task.owner_id !== user.id) {
    return { error: 'Hanya PIC task yang dapat mengajukan permintaan bantuan.' }
  }

  const { data: recipient, error: recipientError } = await supabase
    .from('users')
    .select('id, status')
    .eq('id', input.neededFromId)
    .maybeSingle()

  if (recipientError) return { error: 'Gagal memeriksa user tujuan support.' }
  if (!recipient || recipient.status !== 'aktif') {
    return { error: 'User tujuan support tidak aktif atau tidak ditemukan.' }
  }

  const { error } = await supabase.from('task_supports').insert({
    task_id: input.taskId,
    needed_from_id: input.neededFromId,
    description,
    status: 'diminta',
  })

  if (error) return { error: 'Gagal mengajukan permintaan bantuan.' }

  revalidatePath(`/tasks/${input.taskId}`)
  return { data: { success: true } }
}

export async function markSupportProvided(input: ProvideSupportInput) {
  const user = await getSessionUser()
  if (!isValidUuid(input.supportId)) return { error: 'ID permintaan support tidak valid.' }

  const supabase = await createClient()
  const { data: support, error: readError } = await supabase
    .from('task_supports')
    .select('id, task_id, needed_from_id, status')
    .eq('id', input.supportId)
    .maybeSingle()

  if (readError) return { error: 'Gagal memeriksa permintaan support.' }
  if (!support) return { error: 'Permintaan support tidak ditemukan atau tidak dapat diakses.' }
  if (support.needed_from_id !== user.id) {
    return { error: 'Hanya user yang dimintai bantuan yang dapat menandai support diberikan.' }
  }
  if (support.status !== 'diminta') {
    return { error: 'Permintaan support ini sudah diproses.' }
  }

  const { data: updatedSupport, error } = await supabase
    .from('task_supports')
    .update({ status: 'diberikan' })
    .eq('id', support.id)
    .eq('needed_from_id', user.id)
    .eq('status', 'diminta')
    .select('id')
    .maybeSingle()

  if (error) return { error: 'Gagal memperbarui status support.' }
  if (!updatedSupport) return { error: 'Permintaan support ini sudah diproses.' }

  revalidatePath(`/tasks/${support.task_id}`)
  return { data: { success: true } }
}

export async function addEvidenceLink(input: AddEvidenceLinkInput) {
  const user = await getSessionUser()
  if (!input || !isValidUuid(input.requirementId)) {
    return { error: 'Persyaratan evidence tidak valid.' }
  }
  if (typeof input.link !== 'string' || !input.link.trim()) {
    return { error: 'Tautan evidence tidak valid.' }
  }

  let url: URL
  try {
    url = new URL(input.link.trim())
  } catch {
    return { error: 'Tautan evidence tidak valid.' }
  }
  if (url.protocol !== 'https:') {
    return { error: 'Tautan evidence harus menggunakan HTTPS.' }
  }

  const supabase = await createClient()
  const { data: requirement, error: requirementError } = await supabase
    .from('evidence_requirements')
    .select('id, task_id')
    .eq('id', input.requirementId)
    .maybeSingle()

  if (requirementError) return { error: 'Gagal memeriksa persyaratan evidence.' }
  if (!requirement) return { error: 'Persyaratan evidence tidak ditemukan atau tidak dapat diakses.' }

  const { error } = await supabase.from('task_evidence').insert({
    requirement_id: requirement.id,
    uploader_id: user.id,
    file_or_link: url.toString(),
  })

  if (error) return { error: 'Gagal menyimpan tautan evidence.' }
  revalidatePath(`/tasks/${requirement.task_id}`)
  revalidatePath('/tasks')
  return { data: { success: true } }
}

export async function uploadTaskEvidence(input: UploadTaskEvidenceInput) {
  const user = await getSessionUser()
  if (!input || !isValidUuid(input.requirementId)) {
    return { error: 'Persyaratan evidence tidak valid.' }
  }

  const file = input.file
  if (
    typeof File === 'undefined' ||
    !(file instanceof File) ||
    file.size <= 0 ||
    file.size > MAX_EVIDENCE_FILE_SIZE ||
    !EVIDENCE_FILE_TYPES[file.type]
  ) {
    return { error: 'File tidak valid. Gunakan PDF, JPG, PNG, atau CSV hingga 20 MB.' }
  }
  if (!(await hasValidEvidenceContent(file))) {
    return { error: 'Isi file tidak sesuai dengan jenis evidence yang dipilih.' }
  }

  const supabase = await createClient()
  const { data: requirement, error: requirementError } = await supabase
    .from('evidence_requirements')
    .select('id, task_id')
    .eq('id', input.requirementId)
    .maybeSingle()

  if (requirementError) return { error: 'Gagal memeriksa persyaratan evidence.' }
  if (!requirement) return { error: 'Persyaratan evidence tidak ditemukan atau tidak dapat diakses.' }

  const extension = EVIDENCE_FILE_TYPES[file.type]
  const storagePath = `${requirement.task_id}/${requirement.id}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) return { error: 'Gagal mengunggah file evidence.' }

  const { error: recordError } = await supabase.from('task_evidence').insert({
    requirement_id: requirement.id,
    uploader_id: user.id,
    file_or_link: storagePath,
  })

  if (recordError) {
    try {
      const admin = createAdminClient()
      const { error: cleanupError } = await admin.storage.from(EVIDENCE_BUCKET).remove([storagePath])
      if (cleanupError) return { error: 'File terunggah, tetapi gagal membersihkan file tanpa catatan evidence.' }
    } catch (error) {
      if (error instanceof AdminConfigurationError) {
        return { error: 'Catatan evidence gagal disimpan dan storage tidak dapat dibersihkan.' }
      }
      throw error
    }
    return { error: 'Gagal menyimpan catatan evidence; file unggahan telah dibatalkan.' }
  }

  revalidatePath(`/tasks/${requirement.task_id}`)
  revalidatePath('/tasks')
  return { data: { success: true } }
}

export async function getTaskEvidenceDownloadUrl(evidenceId: string) {
  if (!isValidUuid(evidenceId)) return { error: 'ID evidence tidak valid.' }

  const supabase = await createClient()
  const { data: evidence, error } = await supabase
    .from('task_evidence')
    .select('file_or_link')
    .eq('id', evidenceId)
    .maybeSingle()

  if (error) return { error: 'Gagal memeriksa evidence.' }
  if (!evidence) return { error: 'Evidence tidak ditemukan atau tidak dapat diakses.' }

  if (evidence.file_or_link.startsWith('https://')) {
    return { data: { url: evidence.file_or_link } }
  }

  const pathPattern = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\/[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\/[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\.(?:pdf|jpg|png|csv)$/i
  if (!pathPattern.test(evidence.file_or_link)) {
    return { error: 'Lokasi file evidence tidak valid.' }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (error) {
    if (error instanceof AdminConfigurationError) {
      return { error: 'Layanan file evidence belum dikonfigurasi.' }
    }
    throw error
  }

  const { data, error: signingError } = await admin.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(evidence.file_or_link, 60, { download: true })

  if (signingError || !data?.signedUrl) {
    return { error: 'Gagal membuat tautan unduhan evidence.' }
  }
  return { data: { url: data.signedUrl } }
}

// ============== REQUEST DEADLINE CHANGE ==============

/**
 * FR-060 — PIC task mengajukan perubahan deadline.
 * Manager ke atas dapat mengubah langsung (tanpa approval).
 */
export async function requestDeadlineChange(input: RequestDeadlineChangeInput) {
  const user = await getSessionUser()
  if (!input || !isValidUuid(input.taskId) || typeof input.newDueDate !== 'string') {
    return { error: 'Data perubahan deadline tidak valid.' }
  }
  const newDue = new Date(input.newDueDate)
  if (!Number.isFinite(newDue.getTime())) {
    return { error: 'Format tanggal tenggat baru tidak valid.' }
  }
  if (newDue <= new Date()) {
    return { error: 'Tanggal tenggat baru harus di masa depan.' }
  }

  const supabase = await createClient()
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, owner_id, due_date, status, org_unit_id')
    .eq('id', input.taskId)
    .maybeSingle()

  if (taskError) return { error: 'Gagal memeriksa task sebelum mengubah deadline.' }
  if (!task) return { error: 'Task tidak ditemukan.' }

  const isOwner = task.owner_id === user.id

  // Manager (level 3) ke atas: langsung ubah tanpa approval
  if (user.roleLevel >= 3) {
    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .update({ due_date: newDue.toISOString() })
      .eq('id', input.taskId)
      .select('id')
      .maybeSingle()

    if (error) return { error: 'Gagal mengubah deadline.' }
    if (!updatedTask) return { error: 'Akses ditolak: task berada di luar cakupan Anda.' }

    revalidatePath(`/tasks/${input.taskId}`)
    revalidatePath('/tasks')
    revalidatePath('/dashboard')
    return { data: { success: true, direct: true } }
  }

  // Staff/PIC: ajukan permohonan
  if (user.roleLevel !== 2 || !isOwner) {
    return { error: 'Hanya PIC task yang dapat mengajukan perubahan deadline.' }
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (!reason) return { error: 'Alasan perubahan deadline wajib diisi.' }
  if (reason.length > 1000) return { error: 'Alasan perubahan deadline maksimal 1000 karakter.' }

  const { error } = await supabase.from('deadline_change_requests').insert({
    task_id: input.taskId,
    requested_by: user.id,
    old_due_date: task.due_date,
    new_due_date: newDue.toISOString(),
    reason,
    status: 'Menunggu approval',
  })

  if (error) return { error: 'Gagal mengajukan perubahan deadline.' }

  revalidatePath(`/tasks/${input.taskId}`)
  return { data: { success: true, direct: false } }
}

// ============== APPROVE / REJECT DEADLINE ==============

/**
 * FR-061 — SM/GM/Super Admin menyetujui atau menolak permohonan perubahan deadline.
 */
export async function approveDeadlineChange(input: ApproveDeadlineInput) {
  const user = await getSessionUser()
  requireRole(user, ROLES.SM)
  if (!input || !isValidUuid(input.requestId)) {
    return { error: 'ID permohonan perubahan deadline tidak valid.' }
  }
  if (input.decision !== 'Disetujui' && input.decision !== 'Ditolak') {
    return { error: 'Keputusan permohonan deadline tidak valid.' }
  }
  const supabase = await createClient()
  const { data: requestId, error } = await supabase.rpc('decide_deadline_change', {
    p_request_id: input.requestId,
    p_decision: input.decision,
  })
  if (error || !requestId) {
    return { error: 'Permohonan tidak ditemukan, sudah diproses, atau berada di luar cakupan Anda.' }
  }

  await writeAuditLog(
    user.id,
    input.decision === 'Disetujui' ? 'approve_deadline' : 'reject_deadline',
    `deadline_change_requests:${requestId}`,
    'Menunggu approval',
    input.decision,
  )
  revalidatePath('/approvals')
  revalidatePath('/tasks')
  revalidatePath('/dashboard')

  return { data: { success: true } }
}

// ============== UPDATE PROGRESS (WBS) ==============

/**
 * FR-032 — Toggle WBS item selesai/belum, lalu hitung ulang progress_pct task.
 */
export async function toggleWbsItem(wbsItemId: string, isDone: boolean, taskId: string) {
  const user = await getSessionUser()
  const supabase = await createClient()

  // Pastikan user adalah PIC task
  const { data: task } = await supabase
    .from('tasks')
    .select('owner_id')
    .eq('id', taskId)
    .single()

  if (!task) return { error: 'Task tidak ditemukan.' }
  if (task.owner_id !== user.id) {
    return { error: 'Hanya PIC task yang dapat memperbarui progress.' }
  }

  const { data: updatedWbs, error } = await supabase
    .from('wbs_items')
    .update({ is_done: isDone })
    .eq('id', wbsItemId)
    .select('id')
    .maybeSingle()

  if (error) return { error: 'Gagal memperbarui item WBS.' }
  if (!updatedWbs) return { error: 'Akses ditolak: item WBS berada di luar cakupan Anda.' }

  // Hitung ulang progress berdasarkan bobot leaf items
  // OQ-17: bobot leaf yang selesai / total bobot leaf * 100
  const { data: allLeafs } = await supabase
    .from('wbs_items')
    .select('id, weight, is_done, parent_id')
    .eq('task_id', taskId)

  if (allLeafs && allLeafs.length > 0) {
    // Cari leaf items (yang tidak menjadi parent siapapun)
    const parentIds = new Set(allLeafs.filter((w) => w.parent_id !== null).map((w) => w.parent_id))
    const leafItems = allLeafs.filter((w) => !parentIds.has(w.id))

    const totalWeight = leafItems.reduce((sum, w) => sum + (w.weight ?? 0), 0)
    const doneWeight = leafItems
      .filter((w) => w.is_done)
      .reduce((sum, w) => sum + (w.weight ?? 0), 0)

    const progress = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0

    const { data: updatedTask, error: progressError } = await supabase
      .from('tasks')
      .update({ progress_pct: progress })
      .eq('id', taskId)
      .select('id')
      .maybeSingle()
    if (progressError) return { error: 'Gagal memperbarui progress task.' }
    if (!updatedTask) return { error: 'Akses ditolak: task berada di luar cakupan Anda.' }
  }

  revalidatePath(`/tasks/${taskId}`)
  return { data: { success: true } }
}
