import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getTaskDetail } from '@/lib/tasks/queries'
import { isValidUuid } from '@/lib/tasks/validation'
import { canOpenTaskReview } from '@/lib/tasks/review-permissions'
import ReviewTaskClient from './ReviewTaskClient'

export const metadata: Metadata = { title: 'Review Task' }

export default async function ReviewTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>
}) {
  const [{ taskId }, user] = await Promise.all([params, getSessionUser()])
  if (!isValidUuid(taskId)) notFound()

  const task = await getTaskDetail(taskId, user)
  if (!task || task.status !== 'Review' || !canOpenTaskReview(user, task)) notFound()

  return <ReviewTaskClient task={task} />
}
