export type ReviewActor = {
  id: string
  roleLevel: number
}

export type ReviewableTask = {
  ownerId: string
  reviewerId: string | null
}

export function canOpenTaskReview(actor: ReviewActor, task: ReviewableTask) {
  if (actor.roleLevel >= 5) return true
  if (task.reviewerId === actor.id) return true
  return task.ownerId === actor.id && actor.roleLevel >= 5 && task.reviewerId === null
}

export function getReviewInboxFilter(actor: ReviewActor): string | null {
  if (actor.roleLevel >= 5) return null
  return `reviewer_id.eq.${actor.id}`
}
