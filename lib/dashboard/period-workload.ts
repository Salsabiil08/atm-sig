import { createClient } from '@/lib/supabase/server'
import type { SessionUser } from '@/lib/auth/session'
import { getTaskScopeFilter } from '@/lib/tasks/scope'

export type WorkloadTask = {
  id: string; ownerId: string; ownerName: string; createdAt: string; startAt: string
  dueAt: string; completedAt: string | null; status: string
}
export type WorkloadTransfer = { taskId: string; fromId: string; toId: string; at: string }
export type PeriodWorkload = { ownerId: string; ownerName: string; total: number; carryOver: number; newTasks: number; completed: number; outstanding: number; overdue: number; completionRate: number }

/**
 * One task per owner per period (not sum of daily snapshots).
 * A transfer splits the assignment timeline; a task may contribute to multiple
 * owners *across* transfers, but counts once for a given owner in this period.
 * Only tasks visible through existing task RLS are included.
 */
export function buildPeriodWorkloads(tasks: readonly WorkloadTask[], transfers: readonly WorkloadTransfer[], from: string, toExclusive: string): PeriodWorkload[] {
  const begin = Date.parse(from), end = Date.parse(toExclusive)
  if (!(end > begin)) throw new Error('Periode Jobload tidak valid')
  const byTask = new Map<string, WorkloadTransfer[]>()
  for (const transfer of transfers) {
    const entries = byTask.get(transfer.taskId) ?? []
    entries.push(transfer)
    byTask.set(transfer.taskId, entries)
  }
  const owners = new Map<string, PeriodWorkload>()
  for (const task of tasks) {
    const created = Date.parse(task.createdAt)
    const started = Math.max(created, Date.parse(task.startAt))
    const finished = task.completedAt ? Date.parse(task.completedAt) : Infinity
    if (!(started < end && finished >= begin)) continue
    const history = (byTask.get(task.id) ?? []).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
    // The earliest transfer's from user is the historical initial owner.
    const segments = [{ ownerId: history[0]?.fromId ?? task.ownerId, at: started }]
    for (const transfer of history) segments.push({ ownerId: transfer.toId, at: Date.parse(transfer.at) })
    const counted = new Set<string>()
    for (let i=0;i<segments.length;i++) {
      const segment = segments[i]
      const segmentStart = Math.max(started, segment.at)
      const segmentEnd = Math.min(finished, i+1 < segments.length ? segments[i+1].at : Infinity)
      if (!(segmentStart < end && segmentEnd >= begin) || counted.has(segment.ownerId)) continue
      counted.add(segment.ownerId)
      const owner = owners.get(segment.ownerId) ?? { ownerId: segment.ownerId, ownerName: segment.ownerId === task.ownerId ? task.ownerName : 'PIC historis', total:0,carryOver:0,newTasks:0,completed:0,outstanding:0,overdue:0,completionRate:0 }
      owner.total++
      if (segmentStart < begin && segmentEnd >= begin && finished >= begin) owner.carryOver++
      else owner.newTasks++
      if (finished >= begin && finished < end && segmentStart <= finished && segmentEnd >= finished) owner.completed++
      else owner.outstanding++
      const cutoff = Math.min(end, Date.now())
      if (Date.parse(task.dueAt) < cutoff && finished > Date.parse(task.dueAt) && segmentStart < cutoff) owner.overdue++
      owners.set(segment.ownerId, owner)
    }
  }
  return [...owners.values()].map(owner => ({ ...owner, completionRate: owner.total ? Math.round(owner.completed / owner.total * 100) : 0 }))
    .sort((a,b) => b.total-a.total || a.ownerId.localeCompare(b.ownerId))
}

export async function getPeriodWorkloads(user: SessionUser, from: string, toExclusive: string): Promise<PeriodWorkload[]> {
  if (user.roleLevel < 3) throw new Error('Tidak berwenang membaca Jobload.')
  const supabase = await createClient()
  const scope = await getTaskScopeFilter(supabase, user)
  const pageSize = 500
  const tasks: WorkloadTask[] = []
  for (let offset=0;offset < 10000;offset+=pageSize) {
    let query = supabase.from('tasks')
      .select('id,owner_id,created_at,start_date,due_date,completed_at,status,users!tasks_owner_id_fkey(name)')
      .lt('created_at',toExclusive)
      .order('created_at',{ascending:true}).range(offset,offset+pageSize-1)
    if (scope) query = query.or(scope)
    const { data,error } = await query
    if (error) throw new Error('Gagal membaca Jobload sesuai cakupan.')
    for (const row of data ?? []) {
      const owner = row.users as {name:string}|null
      tasks.push({id:row.id,ownerId:row.owner_id,ownerName:owner?.name??'PIC',createdAt:row.created_at,startAt:row.start_date,dueAt:row.due_date,completedAt:row.completed_at,status:row.status})
    }
    if ((data?.length ?? 0) < pageSize) break
    if (offset + pageSize >= 10000) throw new Error('Jobload melebihi batas aman 10.000 task; perkecil periode atau optimalkan agregasi server.')
  }
  const transfers: WorkloadTransfer[] = []
  // Fetch reassignment history only for visible tasks, in bounded batches.
  for (let i=0;i<tasks.length;i+=100) {
    const taskIds=tasks.slice(i,i+100).map(t=>t.id)
    if (!taskIds.length) continue
    const {data,error}=await supabase.from('task_reassignments')
      .select('task_id,from_user_id,to_user_id,created_at').in('task_id',taskIds)
      .order('created_at',{ascending:true})
    if (error) throw new Error('Riwayat PIC Jobload tidak tersedia.')
    for (const row of data??[]) transfers.push({taskId:row.task_id,fromId:row.from_user_id,toId:row.to_user_id,at:row.created_at})
  }
  return buildPeriodWorkloads(tasks,transfers,from,toExclusive)
}
