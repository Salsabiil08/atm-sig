import type { TaskListItem } from './queries'

function dateOnly(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value))
  const year = parts.find((item) => item.type === 'year')?.value ?? ''
  const month = parts.find((item) => item.type === 'month')?.value ?? ''
  const day = parts.find((item) => item.type === 'day')?.value ?? ''
  return `${year}-${month}-${day}`
}

function dayDifference(a: string, b: string) {
  const start = new Date(`${a}T00:00:00+07:00`).getTime()
  const end = new Date(`${b}T00:00:00+07:00`).getTime()
  return Math.round((end - start) / 86_400_000)
}

export function getTimelineBarPosition(startDate: string, dueDate: string, month: string) {
  const dayCount = getMonthDayCount(month)
  const firstDay = `${month}-01`
  const start = dateOnly(startDate)
  const end = dateOnly(dueDate)
  const leftDay = Math.max(0, dayDifference(firstDay, start))
  const rightDay = Math.min(dayCount - 1, dayDifference(firstDay, end))
  const visible = rightDay >= leftDay

  return {
    visible,
    leftPct: visible ? (leftDay / dayCount) * 100 : 0,
    widthPct: visible ? ((rightDay - leftDay + 1) / dayCount) * 100 : 0,
  }
}

export function getMonthDayCount(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
}

export function getActiveTaskWorkloads(tasks: Pick<TaskListItem, 'ownerId' | 'ownerName' | 'status'>[]) {
  const counts = new Map<string, { id: string; name: string; count: number }>()
  for (const task of tasks) {
    if (task.status === 'Done') continue
    const current = counts.get(task.ownerId)
    if (current) current.count += 1
    else counts.set(task.ownerId, { id: task.ownerId, name: task.ownerName, count: 1 })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'id'))
}
