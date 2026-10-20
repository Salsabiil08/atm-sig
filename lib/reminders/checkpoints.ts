export const REMINDER_CHECKPOINTS = [50, 80, 90] as const
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export type ReminderCheckpoint = (typeof REMINDER_CHECKPOINTS)[number]
export type ReminderTaskStatus =
  | 'To do'
  | 'In progress'
  | 'Blocked'
  | 'Review'
  | 'Revisi'
  | 'Done'

export type WeightedWorkItem = {
  id: string
  parentId: string | null
  weight: number
  isDone: boolean
}

export type ReminderCheckpointInput = {
  startDate: string
  dueDate: string
  now: Date
  status: ReminderTaskStatus
  progressPct: number
  workItems?: WeightedWorkItem[]
}

export type ReminderCheckpointState = {
  elapsedPct: number
  workCompletedPct: number
  isShortTask: boolean
  dueCheckpoints: ReminderCheckpoint[]
}

export function calculateWeightedWorkProgress(items: WeightedWorkItem[]): number | null {
  if (items.length === 0) return null
  const parentIds = new Set(items.flatMap((item) => item.parentId ? [item.parentId] : []))
  const leaves = items.filter((item) => !parentIds.has(item.id))
  if (leaves.length === 0 || leaves.some((item) => !Number.isFinite(item.weight) || item.weight < 0)) {
    return null
  }

  const totalWeight = leaves.reduce((total, item) => total + item.weight, 0)
  if (totalWeight <= 0) return null
  const completedWeight = leaves.reduce(
    (total, item) => total + (item.isDone ? item.weight : 0),
    0,
  )

  return Math.round((completedWeight / totalWeight) * 100)
}

export function calculateReminderCheckpointState(
  input: ReminderCheckpointInput,
): ReminderCheckpointState | null {
  const start = new Date(input.startDate).getTime()
  const due = new Date(input.dueDate).getTime()
  const now = input.now.getTime()
  if (![start, due, now].every(Number.isFinite) || due <= start || now < start || now >= due) {
    return null
  }

  const duration = due - start
  const elapsedPct = ((now - start) / duration) * 100
  const isShortTask = duration < ONE_DAY_MS
  const workCompletedPct = isShortTask
    ? calculateWeightedWorkProgress(input.workItems ?? [])
    : input.progressPct
  if (workCompletedPct === null) return null

  const dueCheckpoints = REMINDER_CHECKPOINTS.filter((checkpoint) => {
    if (elapsedPct < checkpoint) return false
    if (input.status === 'Done') return false
    if (isShortTask) return workCompletedPct < checkpoint
    return checkpoint !== 50 || workCompletedPct < 50
  })

  return {
    elapsedPct,
    workCompletedPct,
    isShortTask,
    dueCheckpoints,
  }
}
