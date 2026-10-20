'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { getTaskEvidenceDownloadUrl, reviewTask } from '@/lib/tasks/actions'
import type { TaskDetail } from '@/lib/tasks/queries'

type Props = { task: TaskDetail }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value))
}

export default function ReviewTaskClient({ task }: Props) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [downloadLinks, setDownloadLinks] = useState<Record<string, string>>({})

  async function decide(decision: 'Done' | 'Revisi') {
    if (decision === 'Revisi' && !comment.trim()) {
      setFeedback('Komentar wajib diisi untuk menolak task.')
      return
    }

    setBusy(true)
    setFeedback('')
    try {
      const result = await reviewTask({ taskId: task.id, decision, comment })
      if (typeof result.error === 'string') {
        setFeedback(result.error)
        return
      }
      if (!result.data) {
        setFeedback('Keputusan review gagal disimpan. Silakan coba lagi.')
        return
      }
      setFeedback(decision === 'Done' ? 'Task disetujui dan selesai.' : 'Task dikembalikan untuk revisi.')
      router.push(`/tasks/${task.id}`)
      router.refresh()
    } catch (error) {
      console.error('Task review failed', error)
      setFeedback('Keputusan review gagal disimpan. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  async function prepareDownload(evidenceId: string) {
    setBusy(true)
    setFeedback('')
    try {
      const result = await getTaskEvidenceDownloadUrl(evidenceId)
      if (typeof result.error === 'string') {
        setFeedback(result.error)
        return
      }
      const url = result.data?.url
      if (!url) {
        setFeedback('Tautan unduhan evidence tidak tersedia.')
        return
      }
      setDownloadLinks((current) => ({ ...current, [evidenceId]: url }))
    } catch (error) {
      console.error('Review evidence download failed', error)
      setFeedback('Tautan evidence gagal disiapkan.')
    } finally {
      setBusy(false)
    }
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void decide('Done')
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Review Task</h1>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
          Menunggu review
        </span>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <dl className="grid grid-cols-1 gap-5 border-b border-slate-100 pb-6 sm:grid-cols-2 lg:grid-cols-4">
          <ReviewMetadata label="Task" value={task.title} />
          <ReviewMetadata label="PIC" value={task.ownerName} />
          <ReviewMetadata label="Tenggat" value={formatDate(task.dueDate)} />
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Progress</dt>
            <dd className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
                <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${task.progressPct}%` }} />
              </span>
              {task.progressPct}%
            </dd>
          </div>
        </dl>

        <section aria-label="Evidence task" className="border-b border-slate-100 py-6">
          <h2 className="text-sm font-bold text-slate-900">Evidence</h2>
          {task.evidenceRequirements.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Tidak ada evidence yang disyaratkan.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {task.evidenceRequirements.map((requirement) => (
                <li key={requirement.id}>
                  <p className="text-sm font-medium text-slate-800">
                    {requirement.description}
                    {requirement.mandatory && <span className="ml-2 text-xs text-slate-500">Wajib</span>}
                  </p>
                  {requirement.evidenceFiles.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-700">Belum diunggah</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {requirement.evidenceFiles.map((evidence) => (
                        <li key={evidence.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500">
                            Diunggah {formatDate(evidence.uploadedAt)} oleh {evidence.uploaderName}
                          </span>
                          {evidence.externalUrl ? (
                            <a className="font-medium text-blue-700 underline" href={evidence.externalUrl} rel="noreferrer" target="_blank">
                              Buka tautan
                            </a>
                          ) : downloadLinks[evidence.id] ? (
                            <a className="font-medium text-blue-700 underline" href={downloadLinks[evidence.id]} rel="noreferrer" target="_blank">
                              Unduh file
                            </a>
                          ) : (
                            <button
                              className="font-medium text-blue-700 underline disabled:opacity-50"
                              disabled={busy}
                              onClick={() => void prepareDownload(evidence.id)}
                              type="button"
                            >
                              Siapkan unduhan
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {feedback && (
          <p role="status" aria-live="polite" className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {feedback}
          </p>
        )}
        <form onSubmit={submitReview} className="pt-6">
          <label className="block text-sm font-semibold text-slate-900" htmlFor="review-comment">
            Komentar reviewer
          </label>
          <textarea
            className="mt-2 w-full rounded-md border border-slate-300 p-3 text-sm focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
            id="review-comment"
            maxLength={5000}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Tulis komentar..."
            rows={4}
            value={comment}
          />
          <p className="mt-1 text-xs text-slate-500">Opsional untuk menyetujui, wajib untuk menolak (Revisi).</p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Link className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" href={`/tasks/${task.id}`}>
              Kembali
            </Link>
            <button
              className="rounded-md border border-red-600 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              disabled={busy}
              onClick={() => void decide('Revisi')}
              type="button"
            >
              Tolak (Revisi)
            </button>
            <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50" disabled={busy} type="submit">
              Setujui (Done)
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

function ReviewMetadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
