// T-504 — Query audit log untuk tampilan UI — FR-092
// Tidak bisa diubah dari aplikasi (audit_logs Update = never di database.types.ts).
// Hanya Manager+ yang dapat mengakses layar ini (requireRole di page.tsx).

import { createClient } from '@/lib/supabase/server'
import type { SessionUser } from '@/lib/auth/session'
import { isValidUuid } from '@/lib/tasks/validation'

export const AUDIT_PAGE_SIZE = 50

export type AuditLogEntry = {
  id: string
  userId: string
  userName: string | null
  action: string
  object: string
  oldValue: string | null
  newValue: string | null
  createdAt: string
}

export type AuditLogFilters = {
  action: string | null
  objectPrefix: string | null
  dateFrom: string | null
  dateTo: string | null
  page: number
}

const JAKARTA_OFFSET = '+07:00'

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function parseAuditFilters(
  raw: { action?: string; object?: string; from?: string; to?: string; page?: string },
): AuditLogFilters {
  const action = raw.action && raw.action.trim() !== '' ? raw.action.trim() : null
  const objectPrefix = raw.object && raw.object.trim() !== '' ? raw.object.trim() : null
  const dateFrom = raw.from && isDateOnly(raw.from) ? raw.from : null
  const dateTo = raw.to && isDateOnly(raw.to) ? raw.to : null

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error('Periode audit log tidak valid.')
  }

  const page = raw.page ? Math.max(1, Number.parseInt(raw.page, 10) || 1) : 1

  return { action, objectPrefix, dateFrom, dateTo, page }
}

export async function getAuditLogs(
  user: SessionUser,
  filters: AuditLogFilters,
): Promise<{ entries: AuditLogEntry[]; hasMore: boolean }> {
  if (!isValidUuid(user.id)) throw new Error('Sesi pengguna tidak valid.')

  const supabase = await createClient()

  const from = (filters.page - 1) * AUDIT_PAGE_SIZE
  const to = from + AUDIT_PAGE_SIZE - 1

  let query = supabase
    .from('audit_logs')
    .select('id, user_id, action, object, old_value, new_value, created_at, users!audit_logs_user_id_fkey(name)')
    .order('created_at', { ascending: false })
    .range(from, to + 1) // fetch one extra to detect hasMore

  if (filters.action) {
    query = query.eq('action', filters.action)
  }
  if (filters.objectPrefix) {
    query = query.like('object', `${filters.objectPrefix}%`)
  }
  if (filters.dateFrom) {
    const startsAt = new Date(`${filters.dateFrom}T00:00:00.000${JAKARTA_OFFSET}`).toISOString()
    query = query.gte('created_at', startsAt)
  }
  if (filters.dateTo) {
    const endsAt = new Date(`${filters.dateTo}T00:00:00.000${JAKARTA_OFFSET}`)
    endsAt.setUTCDate(endsAt.getUTCDate() + 1)
    query = query.lt('created_at', endsAt.toISOString())
  }

  const { data, error } = await query
  if (error) throw new Error('Gagal memuat audit log.')

  const rows = data ?? []
  const hasMore = rows.length > AUDIT_PAGE_SIZE
  const entries: AuditLogEntry[] = rows.slice(0, AUDIT_PAGE_SIZE).map((row) => {
    const userRel = row.users as { name: string } | null
    return {
      id: row.id,
      userId: row.user_id,
      userName: userRel?.name ?? null,
      action: row.action,
      object: row.object,
      oldValue: row.old_value,
      newValue: row.new_value,
      createdAt: row.created_at,
    }
  })

  return { entries, hasMore }
}

/** Daftar action yang tercatat pada audit_logs — dipakai sebagai pilihan filter. */
export const KNOWN_AUDIT_ACTIONS = [
  'invite',
  'update-name',
  'activate',
  'deactivate',
  'assign-role',
  'propose-role',
  'approve-role-proposal',
  'reject-role-proposal',
  'create',
  'update',
  'delete',
  'update_status',
  'review_task',
  'approve_deadline',
  'reject_deadline',
  'update_deadline_direct',
  'update_start_date_direct',
  'task_categories_insert',
  'task_categories_update',
  'task_categories_delete',
  'task_templates_insert',
  'task_templates_update',
  'task_templates_delete',
] as const
