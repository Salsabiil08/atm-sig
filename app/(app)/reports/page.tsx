import WorkspaceTabs, { REPORT_TABS } from '../_components/WorkspaceTabs'
import type { Metadata } from 'next'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import {
  getPerformanceReport,
  parseReportFilters,
} from '@/lib/reports/queries'

export const metadata: Metadata = { title: 'Laporan' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function singleParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) throw new Error('Parameter filter laporan tidak valid.')
  return value
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value))
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-xs font-medium text-slate-500">{label}</h2>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </article>
  )
}

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const [user, params] = await Promise.all([getSessionUser(), searchParams])
  requireRole(user, 'Manager')
  const filters = parseReportFilters({
    dateFrom: singleParam(params.from),
    dateTo: singleParam(params.to),
    orgUnitId: singleParam(params.orgUnit),
  })
  const report = await getPerformanceReport(user, filters)
  const rate = report.summary.onTimeRate === null
    ? 'N/A'
    : `${report.summary.onTimeRate}%`

  // Buat query string untuk tombol export (FR-091)
  const exportQs = new URLSearchParams({
    from: filters.dateFrom,
    to:   filters.dateTo,
    ...(filters.orgUnitId !== null ? { orgUnit: String(filters.orgUnitId) } : {}),
  }).toString()

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <WorkspaceTabs current="/reports" tabs={REPORT_TABS} />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">LAPORAN TASK</h1>
          <p className="mt-1 text-sm text-slate-500">
            Progres, ketepatan waktu, dan task terlambat berdasarkan tenggat dalam periode.
          </p>
        </div>
        {/* Tombol Export — FR-091 */}
        <div className="flex shrink-0 gap-2">
          <a
            id="btn-export-xlsx"
            href={`/api/reports/export?format=xlsx&${exportQs}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <svg className="h-3.5 w-3.5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12v6m0 0l-3-3m3 3l3-3M4 8l8-8 8 8" />
            </svg>
            Excel (.xlsx)
          </a>
          <a
            id="btn-export-pdf"
            href={`/api/reports/export?format=pdf&${exportQs}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <svg className="h-3.5 w-3.5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF
          </a>
        </div>
      </header>

      <form
        method="get"
        action="/reports"
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_auto]"
      >
        <label className="text-xs font-medium text-slate-700">
          Dari tanggal
          <input
            type="date"
            name="from"
            defaultValue={filters.dateFrom}
            required
            className="mt-1 block w-full rounded-md border-slate-300 text-sm focus:border-red-600 focus:ring-red-600"
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Sampai tanggal
          <input
            type="date"
            name="to"
            defaultValue={filters.dateTo}
            required
            className="mt-1 block w-full rounded-md border-slate-300 text-sm focus:border-red-600 focus:ring-red-600"
          />
        </label>
        <label className="text-xs font-medium text-slate-700">
          Unit/section
          <select
            name="orgUnit"
            defaultValue={filters.orgUnitId?.toString() ?? ''}
            className="mt-1 block w-full rounded-md border-slate-300 text-sm focus:border-red-600 focus:ring-red-600"
          >
            <option value="">Semua dalam cakupan</option>
            {report.orgUnits.map((orgUnit) => (
              <option key={orgUnit.id} value={orgUnit.id}>
                {orgUnit.parentUnitName
                  ? `${orgUnit.parentUnitName} / ${orgUnit.name}`
                  : orgUnit.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
        >
          Terapkan
        </button>
      </form>

      <section aria-label="Ringkasan laporan" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Task jatuh tempo" value={report.summary.dueCount} />
        <MetricCard label="Selesai" value={report.summary.completedCount} />
        <MetricCard label="Selesai tepat waktu" value={`${report.summary.onTimeCount} (${rate})`} />
        <MetricCard label="Terlambat" value={report.summary.lateCount} />
        <MetricCard label="Rata-rata progress" value={`${report.summary.averageProgress}%`} />
      </section>

      <section aria-labelledby="report-by-org-heading">
        <h2 id="report-by-org-heading" className="mb-3 text-sm font-bold text-slate-900">
          Progress dan ketepatan waktu per unit/section
        </h2>
        {report.rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-600">
            Tidak ada task dengan tenggat pada periode ini.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Unit/section</th>
                  <th scope="col" className="px-4 py-3">Task</th>
                  <th scope="col" className="px-4 py-3">Progress rata-rata</th>
                  <th scope="col" className="px-4 py-3">Tepat waktu</th>
                  <th scope="col" className="px-4 py-3">Terlambat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((row) => (
                  <tr key={row.orgUnitId}>
                    <th scope="row" className="px-4 py-3 font-medium text-slate-800">
                      {row.parentUnitName
                        ? `${row.parentUnitName} / ${row.orgUnitName}`
                        : row.orgUnitName}
                    </th>
                    <td className="px-4 py-3 text-slate-700">
                      {row.completedCount} selesai / {row.taskCount}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.averageProgress}%</td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.onTimeCount} / {row.dueCount} ({row.onTimeRate === null ? 'N/A' : `${row.onTimeRate}%`})
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.lateCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="late-tasks-heading">
        <h2 id="late-tasks-heading" className="mb-3 text-sm font-bold text-slate-900">
          Task terlambat
        </h2>
        {report.lateTasks.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-600">
            Tidak ada task terlambat pada periode ini.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Task</th>
                  <th scope="col" className="px-4 py-3">PIC</th>
                  <th scope="col" className="px-4 py-3">Tenggat</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.lateTasks.map((task) => (
                  <tr key={task.id}>
                    <th scope="row" className="px-4 py-3 font-medium text-slate-800">{task.title}</th>
                    <td className="px-4 py-3 text-slate-700">{task.ownerName}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(task.dueDate)}</td>
                    <td className="px-4 py-3 text-slate-700">{task.status}</td>
                    <td className="px-4 py-3 text-slate-700">{task.progressPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Ketepatan waktu = task Done sebelum/saat tenggat ÷ seluruh task dengan tenggat dalam periode.
        Task yang belum Done setelah tenggat dan task selesai terlambat masuk hitungan terlambat.
        Periode menggunakan tanggal Asia/Jakarta ({filters.dateFrom}–{filters.dateTo}).
      </p>
    </div>
  )
}