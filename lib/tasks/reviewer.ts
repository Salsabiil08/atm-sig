export type TaskReviewerProfile = {
  id: string
  roleLevel: number
  supervisorId: string | null
  active: boolean
}

export function isValidTaskReviewer(
  owner: TaskReviewerProfile,
  reviewer: TaskReviewerProfile | null,
): boolean {
  if (!owner.active) return false

  if (owner.roleLevel >= 5) {
    return owner.supervisorId === null && reviewer === null
  }

  return (
    owner.roleLevel >= 2 &&
    owner.roleLevel <= 4 &&
    owner.supervisorId !== null &&
    reviewer !== null &&
    reviewer.active &&
    reviewer.id === owner.supervisorId &&
    reviewer.roleLevel === owner.roleLevel + 1
  )
}
