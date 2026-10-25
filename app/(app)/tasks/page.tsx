import WorkspaceTabs, { WORK_TABS } from '../_components/WorkspaceTabs'
// FR-029 — Halaman Daftar Task
// Sesuai Stitch mockup 06_daftar_task: tabel task dengan filter, search, status badge

import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/auth/session'
import { getTaskFilterOptions, getTaskList } from '@/lib/tasks/queries'
import { StatusBadge, PriorityBadge, ProgressBar } from '../_components/ui/Badges'
import Link from 'next/link'
import type { TaskStatus } from '@/lib/constants/rbac'

export const metadata: Metadata = { title: 'Daftar Tugas' }

type SearchParams = {
  status?: string
  priority?: string
  search?: string
  section?: string
  owner?: string
  mine?: string
  from?: string
  to?: string
  page?: string
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso))
}

function isValidStatus(s: string): s is TaskStatus {
  return ['To do', 'In progress', 'Blocked', 'Review', 'Revisi', 'Done'].includes(s)
}

function isValidPriority(s: string): s is 'rendah' | 'sedang' | 'tinggi' {
  return ['rendah', 'sedang', 'tinggi'].includes(s)
}

const STATUS_OPTIONS: Array<{ value: TaskStatus | ''; label: string }> = [
  { value: '', label: 'Semua Status' },
  { value: 'To do', label: 'Belum Dimulai' },
  { value: 'In progress', label: 'Dalam Pengerjaan' },
  { value: 'Blocked', label: 'Terhambat' },
  { value: 'Review', label: 'Menunggu Tinjauan' },
  { value: 'Revisi', label: 'Perlu Revisi' },
  { value: 'Done', label: 'Selesai' },
]

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [params, user] = await Promise.all([searchParams, getSessionUser()])

  const statusFilter = params.status && isValidStatus(params.status) ? params.status : null
  const priorityFilter =
    params.priority && isValidPriority(params.priority) ? params.priority : null
  const searchFilter = params.search || null
  const sectionFilter = params.section && /^\d+$/.test(params.section)
    ? Number(params.section)
    : null
  const isMine = user.roleLevel < 3 || params.mine === '1'
  const ownerFilter = isMine ? user.id : params.owner || null
  const dateFromFilter = params.from || null
  const dateToFilter = params.to || null
  const page = parseInt(params.page ?? '1', 10)

  const [{ items: tasks, total }, filterOptions] = await Promise.all([
    getTaskList(user, {
      status: statusFilter,
      priority: priorityFilter,
      search: searchFilter,
      orgUnitId: sectionFilter,
      ownerId: ownerFilter,
      dateFrom: dateFromFilter,
      dateTo: dateToFilter,
      page,
      pageSize: 20,
    }),
    getTaskFilterOptions(user),
  ])

  const totalPages = Math.ceil(total / 20)

  function buildHref(overrides: Partial<SearchParams>) {
    const merged = { ...params, ...overrides }
    const qs = new URLSearchParams()
    if (merged.status) qs.set('status', merged.status)
    if (merged.priority) qs.set('priority', merged.priority)
    if (merged.search) qs.set('search', merged.search)
    if (merged.section) qs.set('section', merged.section)
    if (merged.owner && !isMine) qs.set('owner', merged.owner)
    if (isMine) qs.set('mine', '1')
    if (merged.from) qs.set('from', merged.from)
    if (merged.to) qs.set('to', merged.to)
    if (merged.page && merged.page !== '1') qs.set('page', merged.page)
    const str = qs.toString()
    return `/tasks${str ? `?${str}` : ''}`
  }

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8">
      <WorkspaceTabs current={isMine ? '/tasks?mine=1' : '/tasks'} tabs={WORK_TABS} roleLevel={user.roleLevel} />
      {/* Judul + tombol buat task */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
            {isMine ? 'Tugas Saya' : 'Tugas Tim'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {total} tugas ditemukan
          </p>
        </div>
        {user.roleLevel >= 2 && (
          <Link
            href="/tasks/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition"
            style={{ backgroundColor: 'var(--color-brand)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Buat Tugas
          </Link>
        )}
      </div>

      {/* Filter bar */}
      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form action="/tasks" method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-slate-600">
            Cari tugas
            <input
              type="search"
              name="search"
              maxLength={100}
              defaultValue={searchFilter ?? ''}
              placeholder="Judul tugas"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
                         focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Status
            <select
              name="status"
              defaultValue={statusFilter ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
                         focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Section
            <select
              name="section"
              defaultValue={sectionFilter ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
                         focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            >
              <option value="">Semua section</option>
              {filterOptions.sections.map((section) => (
                <option key={section.id} value={section.id}>{section.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            PIC
            <select
              name="owner"
              defaultValue={ownerFilter ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
                         focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            >
              <option value="">Semua PIC</option>
              {filterOptions.owners.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Prioritas
            <select
              name="priority"
              defaultValue={priorityFilter ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
                         focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
            >
              <option value="">Semua prioritas</option>
              <option value="rendah">Rendah</option>
              <option value="sedang">Sedang</option>
              <option value="tinggi">Tinggi</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Periode mulai
            <input
              type="date"
              name="from"
              defaultValue={dateFromFilter ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Periode sampai
            <input
              type="date"
              name="to"
              defaultValue={dateToFilter ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: 'var(--color-brand)' }}
            >
              Terapkan filter
            </button>
            <Link
              href="/tasks"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Reset
            </Link>
          </div>
        </form>
      </div>

      {/* Tabel task */}
      {tasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
          <p className="text-sm text-slate-400">
            {searchFilter || statusFilter
              ? 'Tidak ada task yang sesuai filter.'
              : 'Belum ada task.'}
          </p>
          {user.roleLevel >= 3 && (
            <Link
              href="/tasks/new"
              className="inline-block mt-4 text-sm font-medium text-[var(--color-brand)] hover:underline"
            >
              Buat task baru →
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-400 tracking-wider bg-slate-50/60">
                <th className="py-3 px-4 font-semibold" scope="col">TASK</th>
                <th className="py-3 px-4 font-semibold" scope="col">PIC</th>
                <th className="py-3 px-4 font-semibold" scope="col">TENGGAT</th>
                <th className="py-3 px-4 font-semibold" scope="col">PRIORITAS</th>
                <th className="py-3 px-4 font-semibold" scope="col">PROGRESS</th>
                <th className="py-3 px-4 font-semibold" scope="col">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 whitespace-nowrap max-w-xs">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="font-semibold text-slate-800 hover:text-[var(--color-brand)] transition-colors block truncate"
                      title={task.title}
                    >
                      {task.title}
                    </Link>
                    <p className="text-slate-400 text-[10px] mt-0.5">{task.orgUnitName}</p>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                    {task.ownerName}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={task.isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}
                    >
                      {formatDate(task.dueDate)}
                    </span>
                    {task.isOverdue && (
                      <span className="ml-1 text-[10px] font-semibold text-red-500">(Lewat)</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <PriorityBadge priority={task.priority} />
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

          {/* Paginasi */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
              <p className="text-xs text-slate-500">
                Halaman {page} dari {totalPages} ({total} task)
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={buildHref({ page: String(page - 1) })}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded bg-white hover:bg-slate-50 transition"
                  >
                    ← Sebelumnya
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={buildHref({ page: String(page + 1) })}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded bg-white hover:bg-slate-50 transition"
                  >
                    Berikutnya →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
