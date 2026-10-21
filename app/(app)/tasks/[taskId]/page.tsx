import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import {
  getTaskDetail,
  getTaskSupportRecipients,
} from '@/lib/tasks/queries'
import { isValidUuid } from '@/lib/tasks/validation'
import TaskDetailClient from './TaskDetailClient'

export const metadata: Metadata = { title: 'Detail Task' }

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>
}) {
  const [{ taskId }, user] = await Promise.all([params, getSessionUser()])
  if (!isValidUuid(taskId)) notFound()

  const task = await getTaskDetail(taskId, user)
  if (!task) notFound()

  const supportRecipients =
    task.ownerId === user.id ? await getTaskSupportRecipients(user.id) : []

  return (
    <TaskDetailClient
      task={task}
      currentUserId={user.id}
      currentUserRoleLevel={user.roleLevel}
      supportRecipients={supportRecipients}
    />
  )
}
