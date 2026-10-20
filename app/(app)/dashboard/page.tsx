// FR-070 — Halaman Dashboard ATM
// Sesuai Stitch mockup 04_dashboard: metric cards + tabel task perlu perhatian

import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/auth/session'
import {
  getDashboardMetrics,
  getDashboardPerformance,
  getTasksPerluPerhatian,
} from '@/lib/dashboard/queries'
import { StatusBadge, ProgressBar, TimeProgress } from '../_components/ui/Badges'
import Link from 'next/link'
import PerformanceOverview from '../_components/PerformanceOverview'

export const metadata: Metadata = { title: 'Dashboard' }

function MetricCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
      <p
        className="text-3xl font-bold"
        style={{ color: color ?? '#1e293b' }}
      >
        {value}
      </p>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso))
}

export default async function DashboardPage() {
  const user = await getSessionUser()
  const [metrics, tasksPerhatian, performance] = await Promise.all([
    getDashboardMetrics(user),
    getTasksPerluPerhatian(user, 10),
    getDashboardPerformance(user),
  ])

  const showAlert =
    metrics.tertinggal > 0 || metrics.blocked > 0

  return (
    <div className="px-8 py-6">
      {/* Judul halaman */}
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
            Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ringkasan task Department of Accounting
          </p>
        </div>
      </section>

      {/* Banner peringatan */}
      {showAlert && (
        <section className="mb-6">
          <div
            className="rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm"
            style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047' }}
            role="alert"
          >
            <div
              className="w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#eab308' }}
            >
              <span className="text-xs font-bold leading-none">!</span>
            </div>
            <p className="text-xs font-medium leading-relaxed" style={{ color: '#854d0e' }}>
              {metrics.tertinggal > 0 && (
                <>{metrics.tertinggal} task melewati checkpoint dengan progress tertinggal. </>
              )}
              {metrics.blocked > 0 && (
                <>{metrics.blocked} task dalam status Blocked dan memerlukan bantuan.</>
              )}
            </p>
          </div>
        </section>
      )}

      {/* Metric cards */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-7"
        aria-label="Ringkasan metrics"
      >
        <MetricCard label="Total Task" value={metrics.totalTask} />
        <MetricCard label="Tertinggal" value={metrics.tertinggal} color="#ea580c" />
        <MetricCard label="Blocked" value={metrics.blocked} color="#dc2626" />
        <MetricCard label="Menunggu Review" value={metrics.menuungguReview} color="#7c3aed" />
        <MetricCard label="Pengajuan Deadline" value={metrics.pengajuanDeadline} color="#2563eb" />
      </section>

      <div className="mb-7">
        <PerformanceOverview performance={performance} />
      </div>

      {/* Tabel task perlu perhatian */}
      <section aria-label="Task perlu perhatian">
        <h2 className="text-sm font-bold text-slate-800 mb-3 tracking-normal">
          Task Perlu Perhatian
        </h2>

        {tasksPerhatian.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
            <p className="text-sm text-slate-400">
              Tidak ada task yang memerlukan perhatian saat ini.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-400 tracking-wider">
                  <th className="py-3 px-4 font-semibold" scope="col">TASK</th>
                  <th className="py-3 px-4 font-semibold" scope="col">PIC</th>
                  <th className="py-3 px-4 font-semibold" scope="col">TENGGAT</th>
                  <th className="py-3 px-4 font-semibold" scope="col">WAKTU BERJALAN</th>
                  <th className="py-3 px-4 font-semibold" scope="col">PROGRESS</th>
                  <th className="py-3 px-4 font-semibold" scope="col">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {tasksPerhatian.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="hover:text-[var(--color-brand)] transition-colors"
                      >
                        {task.title}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {task.ownerName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {formatDate(task.dueDate)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <TimeProgress
                        timePct={task.timePct}
                        isOverdue={task.isOverdue}
                      />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <ProgressBar value={task.progressPct} />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={task.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tasksPerhatian.length > 0 && (
          <div className="mt-3 text-right">
            <Link
              href="/tasks"
              className="text-xs text-[var(--color-brand)] hover:underline font-medium"
            >
              Lihat semua task →
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
