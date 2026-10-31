import Link from 'next/link'
import type { Metadata } from 'next'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import { ROLES } from '@/lib/constants/rbac'
import { getTaskMasterData } from '@/lib/task-masters/queries'
import TaskTemplateManager from '../../task-templates/TaskTemplateManager'

export const metadata: Metadata = { title: 'Tugas Berulang' }

export default async function RecurringTasksPage() {
  const user = await getSessionUser()
  requireRole(user, ROLES.STAFF_PIC)
  const data = await getTaskMasterData(user)
  return <>
    <nav aria-label="Jenis tugas" className="mx-auto flex max-w-6xl gap-2 px-4 pt-5">
      <Link href="/tasks/new" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Tugas Sekali Jalan</Link>
      <span aria-current="page" className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">Tugas Berulang</span>
    </nav>
    <TaskTemplateManager {...data} mode="recurring" />
  </>
}
