export type TaskDetailsInput = {
  title: string
  ownerId: string
  reviewerId: string | null
  orgUnitId: number
  parentTaskId: string | null
  priority: 'rendah' | 'sedang' | 'tinggi'
  startDate: string
  dueDate: string
}

export type EvidenceRequirementInput = {
  description: string
  mandatory: boolean
}

export type TaskDetailsValidation =
  | { ok: true; data: TaskDetailsInput }
  | { ok: false; error: string }

const UUID_PATTERN = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i
const PRIORITIES = ['rendah', 'sedang', 'tinggi'] as const
type TaskPriority = (typeof PRIORITIES)[number]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isOptionalUuid(value: unknown): value is string | null {
  return value === null || isValidUuid(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && PRIORITIES.some((priority) => priority === value)
}

export function validateTaskDetails(value: unknown): TaskDetailsValidation {
  if (!isRecord(value)) return { ok: false, error: 'Data task tidak valid.' }

  const title = typeof value.title === 'string' ? value.title.trim() : ''
  if (title.length === 0) {
    return { ok: false, error: 'Judul task wajib diisi.' }
  }

  if (!isValidUuid(value.ownerId)) {
    return { ok: false, error: 'PIC task tidak valid.' }
  }

  if (!isOptionalUuid(value.reviewerId)) {
    return { ok: false, error: 'Reviewer task tidak valid.' }
  }

  if (!isPositiveInteger(value.orgUnitId)) {
    return { ok: false, error: 'Penempatan task tidak valid.' }
  }

  if (!isOptionalUuid(value.parentTaskId)) {
    return { ok: false, error: 'Task induk tidak valid.' }
  }

  if (!isTaskPriority(value.priority)) {
    return { ok: false, error: 'Prioritas task tidak valid.' }
  }

  if (typeof value.startDate !== 'string' || typeof value.dueDate !== 'string') {
    return { ok: false, error: 'Tanggal mulai dan tenggat wajib diisi.' }
  }

  const startDate = new Date(value.startDate)
  const dueDate = new Date(value.dueDate)
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(dueDate.getTime())) {
    return { ok: false, error: 'Format tanggal task tidak valid.' }
  }
  if (dueDate <= startDate) {
    return { ok: false, error: 'Tenggat harus setelah tanggal mulai.' }
  }

  return {
    ok: true,
    data: {
      title,
      ownerId: value.ownerId,
      reviewerId: value.reviewerId,
      orgUnitId: value.orgUnitId,
      parentTaskId: value.parentTaskId,
      priority: value.priority,
      startDate: startDate.toISOString(),
      dueDate: dueDate.toISOString(),
    },
  }
}

export function validateEvidenceRequirements(
  value: unknown,
): { ok: true; data: EvidenceRequirementInput[] } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, data: [] }
  if (!Array.isArray(value)) {
    return { ok: false, error: 'Daftar evidence wajib tidak valid.' }
  }

  const requirements: EvidenceRequirementInput[] = []
  for (const requirement of value) {
    if (
      !isRecord(requirement) ||
      typeof requirement.description !== 'string' ||
      typeof requirement.mandatory !== 'boolean'
    ) {
      return { ok: false, error: 'Persyaratan evidence tidak valid.' }
    }
    const description = requirement.description.trim()
    if (!description) {
      return { ok: false, error: 'Deskripsi evidence wajib diisi.' }
    }
    requirements.push({ description, mandatory: requirement.mandatory })
  }

  return { ok: true, data: requirements }
}
