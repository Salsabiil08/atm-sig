import type { Metadata } from 'next'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import { getDashboardPerformance } from '@/lib/dashboard/queries'
import PerformanceOverview from '../_components/PerformanceOverview'

export const metadata: Metadata = { title: 'Kinerja & Job Load' }

export default async function PerformancePage() {
  const user = await getSessionUser()
  requireRole(user, 'Manager')
  const performance = await getDashboardPerformance(user)

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          DASHBOARD KINERJA DAN JOB LOAD
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Progress task aktif dan beban kerja dalam cakupan organisasi Anda.
        </p>
      </header>
      <PerformanceOverview performance={performance} showAllOwners />
    </div>
  )
}
