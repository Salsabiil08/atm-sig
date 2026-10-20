import type { TaskStatus } from '@/lib/constants/rbac'

export function isTaskOverdue(dueDate: string, status: TaskStatus, now = new Date()): boolean {
  const dueAt = new Date(dueDate).getTime()
  const nowAt = now.getTime()
  return status !== 'Done'
    && Number.isFinite(dueAt)
    && Number.isFinite(nowAt)
    && dueAt <= nowAt
}
