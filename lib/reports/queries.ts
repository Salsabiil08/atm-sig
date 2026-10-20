import { createClient } from '@/lib/supabase/server'
import type { SessionUser } from '@/lib/auth/session'
import type { TaskStatus } from '@/lib/constants/rbac'
import { isTaskOverdue } from '@/lib/tasks/deadline'
import { getTaskScopeFilter } from '@/lib/tasks/scope'
import { isValidUuid } from '@/lib/tasks/validation'

const REPORT_PAGE_SIZE = 500
const JAKARTA_OFFSET = '+07:00'

export type ReportFilters = {
  dateFrom: string
  dateTo: string
  orgUnitId: number | null
}

export type ReportTaskSource = {
  id: string
  title: string
  status: TaskStatus
  progressPct: number
  dueDate: string
  completedAt: string | null
  ownerName: string
  orgUnitId: number
  orgUnitName: string
  parentUnitName: string | null
  deadlineRevisions?: DeadlineRevision[]
}

export type DeadlineRevision = {
  oldDate: string
  newDate: string
  changedAt: string
}

export type PerformanceReportRow = {
  orgUnitId: number
  orgUnitName: string
  parentUnitName: string | null
  taskCount: number
  completedCount: number
  dueCount: number
  onTimeCount: number
  onTimeRate: number | null
  lateCount: number
  averageProgress: number
}

export type LateReportTask = Pick<
  ReportTaskSource,
  'id' | 'title' | 'status' | 'dueDate' | 'completedAt' | 'ownerName' | 'progressPct'
>

export type PerformanceReport = {
  summary: {
    taskCount: number
    completedCount: number
    dueCount: number
    onTimeCount: number
    onTimeRate: number | null
    lateCount: number
    averageProgress: number
  }
  rows: PerformanceReportRow[]
  lateTasks: LateReportTask[]
  orgUnits: {
    id: number
    name: string
    parentUnitName: string | null
  }[]
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function dateOnlyInJakarta(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((entry) => entry.type === type)?.value
  const year = part('year')
  const month = part('month')
  const day = part('day')
  if (!year || !month || !day) throw new Error('Gagal menentukan periode laporan.')
  return `${year}-${month}-${day}`
}

export function parseReportFilters(
  values: { dateFrom?: string; dateTo?: string; orgUnitId?: string },
  now = new Date(),
): ReportFilters {
  const today = dateOnlyInJakarta(now)
  const dateFrom = values.dateFrom ?? `${today.slice(0, 7)}-01`
  const month = Number(today.slice(5, 7))
  const year = Number(today.slice(0, 4))
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const dateTo = values.dateTo ?? `${today.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`

  if (!isDateOnly(dateFrom) || !isDateOnly(dateTo) || dateFrom > dateTo) {
    throw new Error('Periode laporan tidak valid.')
  }

  let orgUnitId: number | null = null
  if (values.orgUnitId !== undefined && values.orgUnitId !== '') {
    if (!/^\d+$/.test(values.orgUnitId)) throw new Error('Filter unit/section tidak valid.')
    orgUnitId = Number(values.orgUnitId)
    if (!Number.isSafeInteger(orgUnitId) || orgUnitId <= 0) {
      throw new Error('Filter unit/section tidak valid.')
    }
  }

  return { dateFrom, dateTo, orgUnitId }
}

export function getReportDateRange(filters: ReportFilters) {
  const startsAt = new Date(`${filters.dateFrom}T00:00:00.000${JAKARTA_OFFSET}`).toISOString()
  const endsAt = new Date(`${filters.dateTo}T00:00:00.000${JAKARTA_OFFSET}`)
  endsAt.setUTCDate(endsAt.getUTCDate() + 1)
  return { startsAt, endsAtExclusive: endsAt.toISOString() }
}

export function buildPerformanceReport(
  tasks: readonly ReportTaskSource[],
  now = new Date(),
  filters?: Pick<ReportFilters, 'dateFrom' | 'dateTo' | 'orgUnitId'>,
): PerformanceReport {
  const reportTasks = tasks.flatMap((task) => {
    const deadline = getDeadlineAtCompletion(task)
    if (filters) {
      const { startsAt, endsAtExclusive } = getReportDateRange(filters)
      const dueTime = new Date(deadline).getTime()
      if (dueTime < new Date(startsAt).getTime() || dueTime >= new Date(endsAtExclusive).getTime()) {
        return []
      }
      if (filters.orgUnitId !== null && task.orgUnitId !== filters.orgUnitId) return []
    }
    return [{ ...task, dueDate: deadline }]
  })
  const orgUnits = [...new Map(reportTasks.map((task) => [
    task.orgUnitId,
    {
      id: task.orgUnitId,
      name: task.orgUnitName,
      parentUnitName: task.parentUnitName,
    },
  ])).values()].sort((a, b) => (
    (a.parentUnitName ?? a.name).localeCompare(b.parentUnitName ?? b.name, 'id')
      || a.name.localeCompare(b.name, 'id')
  ))
  const groups = new Map<number, {
    orgUnitId: number
    orgUnitName: string
    parentUnitName: string | null
    taskCount: number
    completedCount: number
    dueCount: number
    onTimeCount: number
    lateCount: number
    progressTotal: number
  }>()
  let completedCount = 0
  let dueCount = 0
  let onTimeCount = 0
  let lateCount = 0
  let progressTotal = 0
  const lateTasks: LateReportTask[] = []

  for (const task of reportTasks) {
    const dueTime = new Date(task.dueDate).getTime()
    const completedTime = task.completedAt === null ? null : new Date(task.completedAt).getTime()
    const isDone = task.status === 'Done'
    const isOnTime = isDone && completedTime !== null && completedTime <= dueTime
    const isLate = isDone
      ? completedTime !== null && completedTime > dueTime
      : isTaskOverdue(task.dueDate, task.status, now)

    const group = groups.get(task.orgUnitId) ?? {
      orgUnitId: task.orgUnitId,
      orgUnitName: task.orgUnitName,
      parentUnitName: task.parentUnitName,
      taskCount: 0,
      completedCount: 0,
      dueCount: 0,
      onTimeCount: 0,
      lateCount: 0,
      progressTotal: 0,
    }
    group.taskCount += 1
    group.dueCount += 1
    group.progressTotal += task.progressPct
    dueCount += 1
    progressTotal += task.progressPct
    if (isDone) {
      completedCount += 1
      group.completedCount += 1
    }
    if (isOnTime) {
      onTimeCount += 1
      group.onTimeCount += 1
    }
    if (isLate) {
      lateCount += 1
      group.lateCount += 1
      lateTasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
        ownerName: task.ownerName,
        progressPct: task.progressPct,
      })
    }
    groups.set(task.orgUnitId, group)
  }

  const toRate = (numerator: number, denominator: number) =>
    denominator === 0 ? null : Math.round((numerator / denominator) * 100)

  return {
    summary: {
      taskCount: reportTasks.length,
      completedCount,
      dueCount,
      onTimeCount,
      onTimeRate: toRate(onTimeCount, dueCount),
      lateCount,
      averageProgress: reportTasks.length === 0 ? 0 : Math.round(progressTotal / reportTasks.length),
    },
    rows: [...groups.values()]
      .map((group) => ({
        orgUnitId: group.orgUnitId,
        orgUnitName: group.orgUnitName,
        parentUnitName: group.parentUnitName,
        taskCount: group.taskCount,
        completedCount: group.completedCount,
        dueCount: group.dueCount,
        onTimeCount: group.onTimeCount,
        onTimeRate: toRate(group.onTimeCount, group.dueCount),
        lateCount: group.lateCount,
        averageProgress: Math.round(group.progressTotal / group.taskCount),
      }))
      .sort((a, b) => {
        const parentOrder = (a.parentUnitName ?? a.orgUnitName)
          .localeCompare(b.parentUnitName ?? b.orgUnitName, 'id')
        return parentOrder || a.orgUnitName.localeCompare(b.orgUnitName, 'id')
      }),
    lateTasks: lateTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    orgUnits,
  }
}

function getDeadlineAtCompletion(task: ReportTaskSource): string {
  if (task.completedAt === null) return task.dueDate
  const completedAt = new Date(task.completedAt).getTime()
  let deadline = task.dueDate
  const laterRevisions = [...(task.deadlineRevisions ?? [])]
    .filter((revision) => new Date(revision.changedAt).getTime() > completedAt)
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
  for (const revision of laterRevisions) deadline = revision.oldDate
  return deadline
}

export async function getPerformanceReport(
  user: SessionUser,
  filters: ReportFilters,
): Promise<PerformanceReport> {
  if (!isValidUuid(user.id)) throw new Error('Sesi pengguna tidak valid.')
  if (!isDateOnly(filters.dateFrom) || !isDateOnly(filters.dateTo) || filters.dateFrom > filters.dateTo) {
    throw new Error('Periode laporan tidak valid.')
  }
  if (
    filters.orgUnitId !== null &&
    (!Number.isSafeInteger(filters.orgUnitId) || filters.orgUnitId <= 0)
  ) {
    throw new Error('Filter unit/section tidak valid.')
  }

  const supabase = await createClient()
  const scopeFilter = await getTaskScopeFilter(supabase, user)
  const tasks: ReportTaskSource[] = []

  for (let offset = 0; ; offset += REPORT_PAGE_SIZE) {
    let query = supabase
      .from('tasks')
      .select(`
        id,
        title,
        status,
        progress_pct,
        due_date,
        completed_at,
        owner_id,
        org_unit_id,
        users!tasks_owner_id_fkey ( name ),
        org_units!tasks_org_unit_id_fkey ( id, name, parent_id )
      `)
      .order('due_date', { ascending: true })
      .range(offset, offset + REPORT_PAGE_SIZE - 1)
    if (scopeFilter) query = query.or(scopeFilter)

    const { data, error } = await query
    if (error) throw new Error('Gagal memuat laporan task.')
    if (!data) throw new Error('Data laporan task tidak tersedia.')

    const taskIds = data.map(({ id }) => id)
    const [deadlineRequests, auditLogs] = await Promise.all([
      supabase
        .from('deadline_change_requests')
        .select('task_id, old_due_date, new_due_date, decided_at')
        .eq('status', 'Disetujui')
        .in('task_id', taskIds),
      supabase
        .from('audit_logs')
        .select('object, old_value, new_value, created_at')
        .eq('action', 'update_deadline_direct')
        .in('object', taskIds.map((id) => `tasks:${id}`)),
    ])
    if (deadlineRequests.error) throw new Error('Gagal memuat histori approval tenggat laporan.')
    if (auditLogs.error) throw new Error('Gagal memuat histori perubahan tenggat laporan.')

    const revisionsByTask = new Map<string, DeadlineRevision[]>()
    for (const request of deadlineRequests.data ?? []) {
      if (!request.decided_at) continue
      const revisions = revisionsByTask.get(request.task_id) ?? []
      revisions.push({
        oldDate: request.old_due_date,
        newDate: request.new_due_date,
        changedAt: request.decided_at,
      })
      revisionsByTask.set(request.task_id, revisions)
    }
    const taskIdsByObject = new Map(taskIds.map((id) => [`tasks:${id}`, id]))
    for (const log of auditLogs.data ?? []) {
      const taskId = taskIdsByObject.get(log.object)
      if (!taskId || !log.old_value || !log.new_value) continue
      const revisions = revisionsByTask.get(taskId) ?? []
      revisions.push({
        oldDate: log.old_value,
        newDate: log.new_value,
        changedAt: log.created_at,
      })
      revisionsByTask.set(taskId, revisions)
    }

    const parentIds = [...new Set(data.flatMap((task) => {
      const orgUnit = task.org_units as { parent_id: number | null } | null
      return orgUnit?.parent_id === null || orgUnit?.parent_id === undefined
        ? []
        : [orgUnit.parent_id]
    }))]
    const parentNames = new Map<number, string>()
    if (parentIds.length > 0) {
      const { data: parents, error: parentError } = await supabase
        .from('org_units')
        .select('id, name')
        .in('id', parentIds)
      if (parentError) throw new Error('Gagal memuat nama unit induk laporan.')
      for (const parent of parents ?? []) parentNames.set(parent.id, parent.name)
    }

    for (const row of data) {
      const owner = row.users as { name: string } | null
      const orgUnit = row.org_units as {
        id: number
        name: string
        parent_id: number | null
      } | null
      if (!owner || !orgUnit) throw new Error('PIC atau unit task tidak tersedia untuk laporan.')
      tasks.push({
        id: row.id,
        title: row.title,
        status: row.status,
        progressPct: row.progress_pct,
        dueDate: row.due_date,
        completedAt: row.completed_at,
        ownerName: owner.name,
        orgUnitId: orgUnit.id,
        orgUnitName: orgUnit.name,
        parentUnitName: orgUnit.parent_id === null ? null : parentNames.get(orgUnit.parent_id) ?? null,
        deadlineRevisions: revisionsByTask.get(row.id) ?? [],
      })
    }

    if (data.length < REPORT_PAGE_SIZE) {
      return buildPerformanceReport(tasks, new Date(), filters)
    }
  }
}
