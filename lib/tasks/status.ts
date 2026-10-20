import type { TaskStatus } from '@/lib/constants/rbac'

export type TaskStatusTransitionContext = {
  isOwner: boolean
  isReviewer: boolean
  canManageTask?: boolean
  ownerRoleLevel: number
}

function isStandardTransition(current: TaskStatus, next: TaskStatus) {
  return (
    (current === 'To do' && next === 'In progress') ||
    (current === 'In progress' && (next === 'Blocked' || next === 'Review')) ||
    (current === 'Blocked' && next === 'In progress') ||
    (current === 'Revisi' && next === 'In progress')
  )
}

export function isAllowedTaskStatusTransition(
  current: TaskStatus,
  next: TaskStatus,
  context: TaskStatusTransitionContext,
): boolean {
  if (current === next) return false

  if (context.isOwner) {
    if (isStandardTransition(current, next)) return true

    return context.ownerRoleLevel >= 5 && (
      ((current === 'In progress' || current === 'Review') && next === 'Done') ||
      (current === 'Review' && next === 'Revisi')
    )
  }

  if (context.canManageTask && isStandardTransition(current, next)) return true

  return context.isReviewer && current === 'Review' && (next === 'Done' || next === 'Revisi')
}
