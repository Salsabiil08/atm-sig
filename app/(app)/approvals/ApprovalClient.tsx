'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { approveDeadlineChange } from '@/lib/tasks/actions'
import type { PendingDeadlineRequest } from '@/lib/tasks/queries'

type Props = { requests: PendingDeadlineRequest[] }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value))
}

export default function ApprovalClient({ requests }: Props) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  async function decide(requestId: string, decision: 'Disetujui' | 'Ditolak') {
    setBusyId(requestId)
    setFeedback('')
    try {
      const result = await approveDeadlineChange({ requestId, decision })
      if (typeof result.error === 'string') {
        setFeedback(result.error)
        return
      }
      if (!result.data) {
        setFeedback('Keputusan gagal disimpan. Silakan coba lagi.')
        return
      }
      setFeedback(decision === 'Disetujui' ? 'Pengajuan disetujui.' : 'Pengajuan ditolak.')
      router.refresh()
    } catch (error) {
      console.error('Deadline approval failed', error)
      setFeedback('Keputusan gagal disimpan. Silakan coba lagi.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Approval Perubahan Deadline
        </h1>
        <p className="mt-1 text-sm text-slate-500">Pengajuan perubahan deadline dari Staff/PIC</p>
      </header>

      {feedback && (
        <p role="status" aria-live="polite" className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {feedback}
        </p>
      )}

      <section aria-label="Daftar pengajuan deadline" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {requests.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Belum ada pengajuan perubahan deadline dalam cakupan Anda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold" scope="col">Task</th>
                  <th className="px-5 py-4 font-semibold" scope="col">PIC</th>
                  <th className="px-5 py-4 font-semibold" scope="col">Deadline lama</th>
                  <th className="px-5 py-4 font-semibold" scope="col">Deadline baru</th>
                  <th className="px-5 py-4 font-semibold" scope="col">Alasan</th>
                  <th className="px-5 py-4 font-semibold" scope="col">Status / Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <tr key={request.id} className="align-top hover:bg-slate-50">
                    <td className="px-5 py-4 font-medium text-slate-900">{request.taskTitle}</td>
                    <td className="px-5 py-4 text-slate-600">{request.requesterName}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{formatDate(request.oldDueDate)}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">{formatDate(request.newDueDate)}</td>
                    <td className="max-w-xs whitespace-pre-wrap px-5 py-4 text-slate-600">{request.reason}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        request.status === 'Menunggu approval'
                          ? 'bg-amber-100 text-amber-800'
                          : request.status === 'Disetujui'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {request.status}
                      </span>
                      {request.status === 'Menunggu approval' ? (
                        <div className="mt-3 flex gap-2">
                          <button
                            className="rounded border border-red-600 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            disabled={busyId !== null}
                            onClick={() => void decide(request.id, 'Ditolak')}
                            type="button"
                          >
                            Tolak
                          </button>
                          <button
                            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            disabled={busyId !== null}
                            onClick={() => void decide(request.id, 'Disetujui')}
                            type="button"
                          >
                            {busyId === request.id ? 'Menyimpan…' : 'Setujui'}
                          </button>
                        </div>
                      ) : (
                        <span className="mt-3 block text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500">
        Approver: SM, GM, atau Super Admin dalam cakupan organisasi. Keputusan dan waktu tercatat pada audit log.
      </aside>
    </main>
  )
}
