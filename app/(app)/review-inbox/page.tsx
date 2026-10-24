import type { Metadata } from 'next'
import Link from 'next/link'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import WorkspaceTabs, { APPROVAL_TABS } from '../_components/WorkspaceTabs'

export const metadata: Metadata = { title: 'Inbox Review Task' }

/** Review inbox scoped by the authenticated user, not a generic task list.
 * The existing review detail endpoint re-checks permissions for every action. */
export default async function ReviewInboxPage() {
  const user = await getSessionUser()
  requireRole(user, 'Manager')

  const supabase = await createClient()
  let query = supabase.from('tasks')
    .select('id, title, due_date, progress_pct')
    .eq('status', 'Review')
    .order('due_date', { ascending: true })
    .limit(100)
  if (user.roleLevel >= 5) {
    query = query.or(`reviewer_id.eq.${user.id},and(owner_id.eq.${user.id},reviewer_id.is.null)`)
  } else {
    query = query.eq('reviewer_id', user.id)
  }

  const { data: tasks, error } = await query
  if (error) throw new Error('Daftar review task gagal dimuat.')

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <WorkspaceTabs current="/review-inbox" tabs={APPROVAL_TABS} roleLevel={user.roleLevel} />
      <header>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Review Task</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Task berstatus Review yang menunggu keputusan Anda. Hanya reviewer yang ditetapkan dapat memutuskan.
        </p>
      </header>
      {!tasks?.length ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center text-sm text-[var(--color-text-secondary)]">
          Tidak ada task yang menunggu review Anda.
        </div>
      ) : (
        <ul className="space-y-3">
          {tasks.map(task => (
            <li key={task.id} className="atm-interactive flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--color-text-primary)]">{task.title}</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Progres {task.progress_pct}% · Tenggat {new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(task.due_date))}
                </p>
              </div>
              <Link href={`/tasks/${task.id}/review`}
                className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Buka Review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
