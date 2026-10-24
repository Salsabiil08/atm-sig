import WorkspaceTabs, { APPROVAL_TABS } from '../_components/WorkspaceTabs'
import type { Metadata } from 'next'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import { ROLES } from '@/lib/constants/rbac'
import { getPendingDeadlineRequests } from '@/lib/tasks/queries'
import ApprovalClient from './ApprovalClient'

export const metadata: Metadata = { title: 'Approval Perubahan Deadline' }

export default async function ApprovalsPage() {
  const user = await getSessionUser()
  requireRole(user, ROLES.SM)
  const requests = await getPendingDeadlineRequests(user)

  return <><div className="px-4 pt-5 sm:px-6 lg:px-8"><WorkspaceTabs current="/approvals" tabs={APPROVAL_TABS} roleLevel={user.roleLevel} /></div><ApprovalClient requests={requests} /></>
}
