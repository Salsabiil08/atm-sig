import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getTaskDetail } from '@/lib/tasks/queries'
import { isValidUuid } from '@/lib/tasks/validation'
import ReviewTaskClient from './ReviewTaskClient'

export const metadata: Metadata = { title: 'Review Task' }

export default async function ReviewTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>
}) {
  const { taskId } = await params
  if (!isValidUuid(taskId)) notFound()

  const user = await getSessionUser()
  const task = await getTaskDetail(taskId, user)
  const isAssignedReviewer = task?.reviewerId === user.id
  const isPrivilegedOwner =
    task?.ownerId === user.id && user.roleLevel >= 5 && task.reviewerId === null
  if (!task || task.status !== 'Review' || (!isAssignedReviewer && !isPrivilegedOwner)) notFound()

  return <ReviewTaskClient task={task} />
}
