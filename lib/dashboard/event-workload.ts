import type { WorkloadTask, PeriodWorkload } from './period-workload'

export type TaskStateEvent = {
  taskId: string
  at: string
  oldStatus: string | null
  newStatus: string
  ownerId: string
  startAt: string
  dueAt: string
  isBaseline: boolean
}
export type EventWorkloadReport = {
  rows: PeriodWorkload[]
  uncertainTaskIds: string[]
  verifiedTaskCount: number
}

type OwnerAccumulator = {
  name: string
  tasks: Set<string>
  carry: Set<string>
  completed: Set<string>
  overdue: Set<string>
}

function epoch(value:string) {
  const stamp=Date.parse(value)
  if(!Number.isFinite(stamp))throw new Error('Tanggal Jobload tidak valid')
  return stamp
}

/** Reconstructs only when the event stream covers the requested period.
 * Before a reliable baseline, the task is marked UNKNOWN, never invented.
 * Each task counts once for each PIC who actually held an active assignment.
 */
export function buildEventWorkloads(
  tasks: readonly WorkloadTask[],
  events: readonly TaskStateEvent[],
  from: string,
  toExclusive: string,
  now = new Date(),
  ownerNames: ReadonlyMap<string,string> = new Map(),
): EventWorkloadReport {
  const begin=epoch(from),end=epoch(toExclusive)
  if(end<=begin)throw new Error('Periode Jobload tidak valid')
  const cutoff=Math.min(end,now.getTime())
  const byTask=new Map<string,TaskStateEvent[]>()
  for(const event of events) {
    const existing=byTask.get(event.taskId)??[]
    existing.push(event)
    byTask.set(event.taskId,existing)
  }
  const accumulators=new Map<string,OwnerAccumulator>()
  const uncertainTaskIds:string[]=[]
  let verifiedTaskCount=0

  for(const task of tasks) {
    const sequence=(byTask.get(task.id)??[]).slice().sort((a,b)=>epoch(a.at)-epoch(b.at))
    const created=epoch(task.createdAt)
    if(created>=end)continue
    const first=sequence[0]
    if(!first) {uncertainTaskIds.push(task.id);continue}
    const firstAt=epoch(first.at)
    // First event is a migration baseline for older tasks (not creation).
    // It CANNOT reconstruct the portion before baseline.
    const firstIsInsert=first.isBaseline && Math.abs(firstAt-created)<60_000
    if(firstAt>begin && !firstIsInsert) {
      uncertainTaskIds.push(task.id)
      continue
    }
    // A state before the first event is unknown. For true INSERT events the task
    // didn't exist before creation; all other cases lack required provenance.
    if(firstAt>begin && created<begin) {
      uncertainTaskIds.push(task.id)
      continue
    }
    verifiedTaskCount++
    const ownersForTask=new Map<string,{
      carry:boolean
      completed:boolean
      overdue:boolean
    }>()

    for(let i=0;i<sequence.length;i++) {
      const state=sequence[i]
      const at=epoch(state.at)
      const next=sequence[i+1]
      const nextAt=next?epoch(next.at):Infinity
      const activeStart=Math.max(begin,at,created,epoch(state.startAt))
      const activeEnd=Math.min(end,nextAt)
      const owner=state.ownerId
      const prior=ownersForTask.get(owner)??{carry:false,completed:false,overdue:false}

      if(state.newStatus!=='Done' && activeStart<activeEnd) {
        if(activeStart<=begin && created<begin)prior.carry=true
        if(epoch(state.dueAt)<cutoff && activeEnd>epoch(state.dueAt))prior.overdue=true
        ownersForTask.set(owner,prior)
      }
      // Events entering Done in this period are completion by that PIC.
      if(state.newStatus==='Done' && state.oldStatus!=='Done' && at>=begin && at<end) {
        prior.completed=true
        ownersForTask.set(owner,prior)
      }
      // A later reopen cancels completion by the same PIC as of period end.
      if(state.newStatus!=='Done' && state.oldStatus==='Done' && at<end) {
        prior.completed=false
        ownersForTask.set(owner,prior)
      }
    }
    for(const [ownerId,data] of ownersForTask) {
      const rec=accumulators.get(ownerId)??{
        name:ownerNames.get(ownerId)??(ownerId===task.ownerId?task.ownerName:'PIC historis'),
        tasks:new Set<string>(),carry:new Set<string>(),
        completed:new Set<string>(),overdue:new Set<string>(),
      }
      rec.tasks.add(task.id)
      if(data.carry)rec.carry.add(task.id)
      if(data.completed)rec.completed.add(task.id)
      if(data.overdue)rec.overdue.add(task.id)
      accumulators.set(ownerId,rec)
    }
  }

  const rows:PeriodWorkload[]=[...accumulators].map(([ownerId,rec])=>{
    const total=rec.tasks.size
    const completed=rec.completed.size
    return {
      ownerId,ownerName:rec.name,total,carryOver:rec.carry.size,
      newTasks:total-rec.carry.size,completed,
      outstanding:total-completed,overdue:rec.overdue.size,
      completionRate:total?Math.round(completed/total*100):0,
    }
  }).sort((a,b)=>b.total-a.total||a.ownerId.localeCompare(b.ownerId))
  return {rows,uncertainTaskIds,verifiedTaskCount}
}
