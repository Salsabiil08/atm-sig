import { buildEventWorkloads, type TaskStateEvent } from './event-workload'
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

export type PeriodWorkloadReport = {rows:PeriodWorkload[];verifiedTasks:number;estimatedTasks:number;quality:'tracked'|'estimated';notice:string}

export async function getPeriodWorkloads(user: SessionUser, from: string, toExclusive: string): Promise<PeriodWorkloadReport> {
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
  // Read the append-only event stream when R.03 history migration is applied.
  // Missing/unverifiable periods are reported as ESTIMATES; never fabricate past events.
  const events:TaskStateEvent[]=[]
  let historyInstalled=true
  for(let i=0;i<tasks.length && historyInstalled;i+=100) {
    const ids=tasks.slice(i,i+100).map(t=>t.id)
    for(let offset=0;offset<10000;offset+=500) {
      const {data,error}=await supabase.from('task_state_events')
        .select('task_id,occurred_at,old_status,new_status,new_owner_id,new_start_date,new_due_date,is_baseline')
        .in('task_id',ids).order('occurred_at',{ascending:true}).order('id',{ascending:true})
        .range(offset,offset+499)
      if(error) {
        if(error.code==='42P01'||error.code==='PGRST205') {historyInstalled=false;break}
        throw new Error('Gagal membaca histori perubahan task.')
      }
      for(const item of data??[]) events.push({
        taskId:item.task_id,at:item.occurred_at,oldStatus:item.old_status,
        newStatus:item.new_status,ownerId:item.new_owner_id,
        startAt:item.new_start_date,dueAt:item.new_due_date,isBaseline:item.is_baseline,
      })
      if((data?.length??0)<500)break
      if(offset+500>=10000)throw new Error('Histori task terlalu besar untuk perhitungan aman.')
    }
  }
  if(!historyInstalled) {
    return {rows:buildPeriodWorkloads(tasks,transfers,from,toExclusive),
      verifiedTasks:0,estimatedTasks:tasks.length,quality:'estimated',
      notice:'Histori status belum tersedia. Angka adalah estimasi berdasarkan snapshot task saat ini.'}
  }

  const ids=[...new Set([...tasks.map(t=>t.ownerId),...events.map(e=>e.ownerId)])]
  const names=new Map<string,string>()
  for(let i=0;i<ids.length;i+=100) {
    const {data}=await supabase.from('users').select('id,name').in('id',ids.slice(i,i+100))
    for(const u of data??[])names.set(u.id,u.name)
  }
  const observed=buildEventWorkloads(tasks,events,from,toExclusive,new Date(),names)
  const uncertain=new Set(observed.uncertainTaskIds)
  const estimated=buildPeriodWorkloads(tasks.filter(t=>uncertain.has(t.id)),transfers,from,toExclusive)
  const byOwner=new Map<string,PeriodWorkload>()
  for(const row of [...observed.rows,...estimated]) {
    const prior=byOwner.get(row.ownerId)
    if(!prior) {byOwner.set(row.ownerId,row);continue}
    const total=prior.total+row.total,completed=prior.completed+row.completed
    byOwner.set(row.ownerId,{
      ...prior,ownerName:names.get(row.ownerId)??prior.ownerName,
      total,carryOver:prior.carryOver+row.carryOver,newTasks:prior.newTasks+row.newTasks,
      completed,outstanding:prior.outstanding+row.outstanding,overdue:prior.overdue+row.overdue,
      completionRate:total?Math.round(completed/total*100):0,
    })
  }
  const estimatedTasks=uncertain.size
  return {
    rows:[...byOwner.values()].sort((a,b)=>b.total-a.total||a.ownerId.localeCompare(b.ownerId)),
    verifiedTasks:observed.verifiedTaskCount,estimatedTasks,
    quality:estimatedTasks>0?'estimated':'tracked',
    notice:estimatedTasks>0
      ? estimatedTasks+' task tidak mempunyai histori lengkap pada awal periode. Angka bagian tersebut adalah estimasi; jangan gunakan sebagai laporan historis final.'
      : 'Periode dihitung dari histori status, PIC dan tenggat yang tercatat setelah baseline migrasi.',
  }
}
