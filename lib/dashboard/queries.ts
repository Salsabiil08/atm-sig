// FR-070 — Dashboard queries: ringkasan metrics dan task perlu perhatian
// NFR-001: hanya dipanggil dari server (Server Component / Server Action)

import { createClient } from '@/lib/supabase/server'
import type { SessionUser } from '@/lib/auth/session'
import type { TaskStatus } from '@/lib/constants/rbac'
import { getTaskScopeFilter } from '@/lib/tasks/scope'
import { isTaskOverdue } from '@/lib/tasks/deadline'

export type DashboardMetrics = {
  totalTask: number
  tertinggal: number   // task yang waktu > 80% tapi progress jauh di bawah
  blocked: number
  menuungguReview: number
  pengajuanDeadline: number
}

export type TaskPerhatian = {
  id: string
  title: string
  ownerName: string
  dueDate: string
  timePct: number
  isOverdue: boolean
  progressPct: number
  status: TaskStatus
}

export type DashboardPerformanceSource = {
  ownerId: string
  ownerName: string
  orgUnitId: number
  orgUnitName: string
  progressPct: number
  status: TaskStatus
  dueDate: string
}

export type DashboardPerformance = {
  owners: {
    id: string
    name: string
    activeTasks: number
    overdueTasks: number
    averageProgress: number
  }[]
  orgUnits: {
    id: number
    name: string
    activeTasks: number
    overdueTasks: number
    averageProgress: number
  }[]
}

/**
 * Menghitung persentase waktu berjalan (0–100+, bisa > 100 jika overdue)
 * OQ-03, implementasi aturan #1: (sekarang - start) / (due - start) * 100
 */
export function calcTimePct(
  startDate: string,
  dueDate: string,
  now = Date.now(),
): number {
  const start = new Date(startDate).getTime()
  const due = new Date(dueDate).getTime()
  if (due <= start) return 0
  return ((now - start) / (due - start)) * 100
}

export function buildDashboardPerformance(
  tasks: readonly DashboardPerformanceSource[],
  now = new Date(),
): DashboardPerformance {
  const ownerStats = new Map<string, {
    id: string
    name: string
    activeTasks: number
    overdueTasks: number
    progressTotal: number
  }>()
  const orgUnitStats = new Map<number, {
    id: number
    name: string
    activeTasks: number
    overdueTasks: number
    progressTotal: number
  }>()

  for (const task of tasks) {
    if (task.status === 'Done') continue

    const overdue = isTaskOverdue(task.dueDate, task.status, now)
    const owner = ownerStats.get(task.ownerId) ?? {
      id: task.ownerId,
      name: task.ownerName,
      activeTasks: 0,
      overdueTasks: 0,
      progressTotal: 0,
    }
    owner.activeTasks += 1
    owner.progressTotal += task.progressPct
    if (overdue) owner.overdueTasks += 1
    ownerStats.set(task.ownerId, owner)

    const orgUnit = orgUnitStats.get(task.orgUnitId) ?? {
      id: task.orgUnitId,
      name: task.orgUnitName,
      activeTasks: 0,
      overdueTasks: 0,
      progressTotal: 0,
    }
    orgUnit.activeTasks += 1
    orgUnit.progressTotal += task.progressPct
    if (overdue) orgUnit.overdueTasks += 1
    orgUnitStats.set(task.orgUnitId, orgUnit)
  }

  const summarize = <T extends {
    activeTasks: number
    progressTotal: number
  }>(stats: T) => {
    const { progressTotal, ...summary } = stats
    return {
      ...summary,
      averageProgress: Math.round(progressTotal / stats.activeTasks),
    }
  }

  return {
    owners: [...ownerStats.values()]
      .map(summarize)
      .sort((a, b) => b.activeTasks - a.activeTasks || a.name.localeCompare(b.name, 'id')),
    orgUnits: [...orgUnitStats.values()]
      .map(summarize)
      .sort((a, b) => a.name.localeCompare(b.name, 'id')),
  }
}

async function getDashboardPerformanceSources(
  user: SessionUser,
): Promise<DashboardPerformanceSource[]> {
  const supabase = await createClient()
  const scopeFilter = await getTaskScopeFilter(supabase, user)
  const pageSize = 500
  const tasks: DashboardPerformanceSource[] = []

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from('tasks')
      .select(`
        owner_id,
        org_unit_id,
        progress_pct,
        status,
        due_date,
        users!tasks_owner_id_fkey ( name ),
        org_units!tasks_org_unit_id_fkey ( name )
      `)
      .order('due_date', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (scopeFilter) query = query.or(scopeFilter)

    const { data, error } = await query
    if (error) throw new Error('Gagal memuat ringkasan progress dashboard.')
    if (!data) throw new Error('Data progress dashboard tidak tersedia.')

    for (const row of data) {
      const owner = row.users as { name: string } | null
      const orgUnit = row.org_units as { name: string } | null
      if (!owner || !orgUnit) {
        throw new Error('Informasi PIC atau section task tidak tersedia.')
      }
      tasks.push({
        ownerId: row.owner_id,
        ownerName: owner.name,
        orgUnitId: row.org_unit_id,
        orgUnitName: orgUnit.name,
        progressPct: row.progress_pct,
        status: row.status,
        dueDate: row.due_date,
      })
    }

    if (data.length < pageSize) return tasks
  }
}

export async function getDashboardPerformance(
  user: SessionUser,
  now = new Date(),
): Promise<DashboardPerformance> {
  const tasks = await getDashboardPerformanceSources(user)
  return buildDashboardPerformance(tasks, now)
}

/**
 * Mengambil metrics ringkasan dashboard sesuai role user.
 */
export async function getDashboardMetrics(user: SessionUser): Promise<DashboardMetrics> {
  const supabase = await createClient()
  const scopeFilter = await getTaskScopeFilter(supabase, user)

  // Query tasks yang visible untuk user ini
  let taskQuery = supabase
    .from('tasks')
    .select('id, status, progress_pct, start_date, due_date, org_unit_id, owner_id, reviewer_id')
  if (scopeFilter) taskQuery = taskQuery.or(scopeFilter)

  // Hitung pengajuan deadline yang menunggu (independen dari query task) — paralel.
  const [{ data: tasks, error }, { count: pendingDeadlines, error: deadlineError }] =
    await Promise.all([
      taskQuery,
      supabase
        .from('deadline_change_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Menunggu approval'),
    ])

  if (error) throw new Error('Gagal memuat ringkasan task dashboard.')
  if (!tasks) throw new Error('Data ringkasan task dashboard tidak tersedia.')

  let tertinggal = 0
  for (const t of tasks) {
    if (t.status === 'Done' || t.status === 'Blocked') continue
    const timePct = calcTimePct(t.start_date, t.due_date)
    const isOverdue = isTaskOverdue(t.due_date, t.status)
    // Tertinggal: overdue, atau waktu > 80% dan progress jauh di bawah waktu.
    if (isOverdue || (timePct > 80 && t.progress_pct < timePct - 20)) {
      tertinggal++
    }
  }

  const blocked = tasks.filter((t) => t.status === 'Blocked').length
  const menuungguReview = tasks.filter((t) => t.status === 'Review').length

  if (deadlineError) throw new Error('Gagal memuat jumlah pengajuan deadline.')

  return {
    totalTask: tasks.length,
    tertinggal,
    blocked,
    menuungguReview,
    pengajuanDeadline: pendingDeadlines ?? 0,
  }
}

/**
 * Mengambil task yang perlu perhatian:
 * - Overdue (deadline sudah lewat dan belum Done)
 * - Waktu > 80% (mendekati deadline)
 * - Status Blocked atau Review lebih dari 3 hari
 * Sesuai Stitch mockup 04_dashboard tabel "Task Perlu Perhatian"
 */
export async function getTasksPerluPerhatian(
  user: SessionUser,
  limit = 10,
): Promise<TaskPerhatian[]> {
  const supabase = await createClient()
  const scopeFilter = await getTaskScopeFilter(supabase, user)

  let taskQuery = supabase
    .from('tasks')
    .select(`
      id,
      title,
      status,
      progress_pct,
      start_date,
      due_date,
      users!tasks_owner_id_fkey ( name )
    `)
    .not('status', 'eq', 'Done')
    .order('due_date', { ascending: true })
    .limit(50)
  if (scopeFilter) taskQuery = taskQuery.or(scopeFilter)
  const { data: tasks, error } = await taskQuery

  if (error) throw new Error('Gagal memuat task yang perlu perhatian.')
  if (!tasks) throw new Error('Data task yang perlu perhatian tidak tersedia.')

  const now = new Date()

  const result: TaskPerhatian[] = tasks
    .map((t) => {
      const timePct = calcTimePct(t.start_date, t.due_date)
      const isOverdue = isTaskOverdue(t.due_date, t.status, now)
      const ownerUser = t.users as { name: string } | null
      return {
        id: t.id,
        title: t.title,
        ownerName: ownerUser?.name ?? '—',
        dueDate: t.due_date,
        timePct,
        isOverdue,
        progressPct: t.progress_pct,
        status: t.status as TaskStatus,
      }
    })
    // Filter: hanya yang memerlukan perhatian
    .filter((t) => t.isOverdue || t.timePct >= 80 || t.status === 'Blocked' || t.status === 'Review')
    .slice(0, limit)

  return result
}
