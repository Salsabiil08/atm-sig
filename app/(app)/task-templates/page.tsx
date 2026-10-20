// T-505 / FR-100 / CR-0003: master kategori dan template task otomatis berkala.

import type { Metadata } from 'next'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import { ROLES } from '@/lib/constants/rbac'
import { getTaskMasterData } from '@/lib/task-masters/queries'
import TaskTemplateManager from './TaskTemplateManager'

export const metadata: Metadata = { title: 'Kategori & Template Task' }

export default async function TaskTemplatesPage() {
  const user = await getSessionUser()
  requireRole(user, ROLES.SM)
  const data = await getTaskMasterData(user)
  return <TaskTemplateManager {...data} />
}
