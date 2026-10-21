import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { getTaskCreationOptions } from '@/lib/tasks/queries'
import CreateTaskForm from './CreateTaskForm'

export const metadata: Metadata = { title: 'Buat Task' }

export default async function NewTaskPage() {
  const user = await getSessionUser()
  if (user.roleLevel < 2) notFound()

  const options = await getTaskCreationOptions(user)
  return <CreateTaskForm {...options} currentUserRoleLevel={user.roleLevel} currentUserId={user.id} />
}
