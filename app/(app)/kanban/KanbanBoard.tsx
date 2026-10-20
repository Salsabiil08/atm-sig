// T-507 / FR-110 / BR-080: status controls follow the role and task state.
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { TASK_STATUSES, type TaskStatus } from '@/lib/constants/rbac'
import type { SessionUser } from '@/lib/auth/session'
import type { TaskListItem } from '@/lib/tasks/queries'
import { updateTaskStatus } from '@/lib/tasks/actions'
import { isAllowedTaskStatusTransition } from '@/lib/tasks/status'

const statusTone: Record<TaskStatus, { panel: string; count: string; dot: string }> = {
  'To do': { panel: 'border-slate-200 bg-slate-50/80', count: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400' },
  'In progress': { panel: 'border-blue-200 bg-blue-50/70', count: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  Blocked: { panel: 'border-amber-200 bg-amber-50/70', count: 'bg-amber-100 text-amber-900', dot: 'bg-amber-500' },
  Review: { panel: 'border-violet-200 bg-violet-50/70', count: 'bg-violet-100 text-violet-900', dot: 'bg-violet-500' },
  Revisi: { panel: 'border-orange-200 bg-orange-50/70', count: 'bg-orange-100 text-orange-900', dot: 'bg-orange-500' },
  Done: { panel: 'border-emerald-200 bg-emerald-50/70', count: 'bg-emerald-100 text-emerald-900', dot: 'bg-emerald-500' },
}

const priorityTone = {
  rendah: 'bg-slate-100 text-slate-600',
  sedang: 'bg-sky-100 text-sky-800',
  tinggi: 'bg-rose-100 text-rose-800',
} as const

function Card({ task, user }: { task: TaskListItem; user: SessionUser }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const isOwner = task.ownerId === user.id
  const isReviewer = task.reviewerId === user.id
  const canSelfReview = isOwner && user.roleLevel >= 5 && task.reviewerId === null
  const canManageTask = user.roleLevel >= 3
  const transitions = task.status !== 'Review'
    ? TASK_STATUSES.filter((next) => isAllowedTaskStatusTransition(task.status, next, {
        isOwner,
        isReviewer: false,
        canManageTask,
        ownerRoleLevel: user.roleLevel,
      }))
    : []

  function move(status: TaskStatus) {
    setMessage('')
    startTransition(async () => {
      const result = await updateTaskStatus({ taskId: task.id, status })
      if ('error' in result) setMessage(result.error ?? 'Status task tidak dapat diperbarui.')
      else router.refresh()
    })
  }

  const dueDate = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(new Date(task.dueDate))

  return (
    <article className="group rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${priorityTone[task.priority]}`}>
          {task.priority}
        </span>
        {task.isOverdue && <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-800">Lewat</span>}
      </div>

      <Link href={`/tasks/${task.id}`} className="mt-3 block text-sm font-semibold leading-5 text-slate-900 decoration-red-600 decoration-2 underline-offset-2 group-hover:text-red-700 group-hover:underline">
        {task.title}
      </Link>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
        <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
          {task.ownerName.slice(0, 1).toLocaleUpperCase('id-ID')}
        </span>
        <span className="min-w-0 truncate">{task.ownerName}</span>
      </div>
      <p className="mt-1 truncate pl-8 text-[11px] text-slate-500">{task.orgUnitName}</p>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px]">
        <span className="text-slate-500">Tenggat</span>
        <time dateTime={task.dueDate} className={task.isOverdue ? 'font-semibold text-red-700' : 'font-medium text-slate-700'}>{dueDate}</time>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div role="progressbar" aria-label={`Progress ${task.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progressPct} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-red-600 transition-[width]" style={{ width: `${task.progressPct}%` }} />
        </div>
        <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-slate-600">{task.progressPct}%</span>
      </div>

      {transitions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5" aria-label="Pindahkan status task">
          {transitions.map((next) => (
            <button key={next} type="button" disabled={pending} onClick={() => move(next)} className="rounded-md border border-slate-200 px-2 py-1.5 text-[10px] font-semibold text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-800 disabled:cursor-wait disabled:opacity-50">
              {pending ? 'Memproses…' : `→ ${next}`}
            </button>
          ))}
        </div>
      )}
      {(isReviewer || canSelfReview) && task.status === 'Review' && (
        <Link href={`/tasks/${task.id}/review`} className="mt-3 inline-flex rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700">
          {canSelfReview ? 'Review sendiri' : 'Buka review'}
        </Link>
      )}
      {message && <p role="alert" className="mt-2 text-xs text-red-700">{message}</p>}
    </article>
  )
}

export default function KanbanBoard({ tasks, user }: { tasks: TaskListItem[]; user: SessionUser }) {
  return (
    <div className="overflow-x-auto pb-3" tabIndex={0} aria-label="Papan Kanban, geser mendatar untuk melihat semua status">
      <div className="grid min-w-[1320px] grid-cols-6 gap-3 xl:gap-4">
        {TASK_STATUSES.map((status) => {
          const cards = tasks.filter((task) => task.status === status)
          const tone = statusTone[status]
          return (
            <section key={status} aria-label={`${status}, ${cards.length} task`} className={`min-h-64 rounded-2xl border p-2.5 ${tone.panel}`}>
              <header className="mb-3 flex items-center justify-between gap-2 px-1 py-1">
                <h2 className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone.dot}`} />
                  {status}
                </h2>
                <span className={`min-w-7 rounded-full px-2 py-1 text-center text-[10px] font-bold tabular-nums ${tone.count}`}>{cards.length}</span>
              </header>
              <div className="space-y-2.5">
                {cards.map((task) => <Card key={task.id} task={task} user={user} />)}
                {cards.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-3 py-7 text-center text-xs text-slate-500">Belum ada task</p>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
