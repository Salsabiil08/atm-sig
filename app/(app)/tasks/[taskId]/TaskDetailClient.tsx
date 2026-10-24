'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  addComment,
  addWbsItem,
  deleteTask,
  updateTask,
  toggleWbsItem,
  addEvidenceLink,
  addSupportRequest,
  getTaskEvidenceDownloadUrl,
  markSupportProvided,
  requestDeadlineChange,
  reassignTask,
  updateTaskStartDate,
  updateTaskProgress,
  updateTaskStatus,
  uploadTaskEvidence,
} from '@/lib/tasks/actions'
import type { TaskCreationOptions, TaskDetail, TaskSupportRecipient } from '@/lib/tasks/queries'
import { TASK_STATUSES } from '@/lib/constants/rbac'
import { isAllowedTaskStatusTransition } from '@/lib/tasks/status'
import { PriorityBadge, ProgressBar, StatusBadge } from '../../_components/ui/Badges'

type Props = {
  task: TaskDetail
  currentUserId: string
  currentUserRoleLevel: number
  supportRecipients: TaskSupportRecipient[]
  reassignmentOptions?: TaskCreationOptions['owners']
}

type ActionResult = { data: { success?: boolean; url?: string; reassignmentId?: string } } | { error: string }

const fieldClass =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600'
const buttonClass =
  'rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'

function formatDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value))
}

function dateInputValue(value: Date) {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(value)
}

export default function TaskDetailClient({
  task,
  currentUserId,
  currentUserRoleLevel,
  supportRecipients,
  reassignmentOptions = [],
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [downloadLinks, setDownloadLinks] = useState<Record<string, string>>({})
  const [deadlineDialogOpen, setDeadlineDialogOpen] = useState(false)
  const [minimumDeadlineDate, setMinimumDeadlineDate] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const isOwner = task.ownerId === currentUserId
  const isReviewer = task.reviewerId === currentUserId
  const canReviewOwnTask = isOwner && currentUserRoleLevel >= 5 && task.reviewerId === null
  const canChangeDeadline = currentUserRoleLevel >= 3 || (currentUserRoleLevel === 2 && isOwner)

  const statusContext = {
    isOwner,
    isReviewer,
    ownerRoleLevel: isOwner ? currentUserRoleLevel : 0,
  }
  const statusActions = TASK_STATUSES.filter(
    (status) => status !== 'Revisi' && isAllowedTaskStatusTransition(task.status, status, statusContext),
  ).filter((status) => {
    if (status === 'Blocked') {
      return task.supports.some((support) => support.status === 'diminta')
    }
    if (task.status === 'Blocked' && status === 'In progress') {
      return task.supports.some((support) => support.status === 'diberikan')
    }
    if (status === 'Review' || status === 'Done') {
      return (
        (isOwner && currentUserRoleLevel >= 5) ||
        task.evidenceRequirements
          .filter((requirement) => requirement.mandatory)
          .every((requirement) => requirement.evidenceFiles.length > 0)
      )
    }
    return true
  })

  async function runAction(action: () => Promise<ActionResult>, successMessage: string) {
    setBusy(true)
    setFeedback('')
    try {
      const result = await action()
      if ('error' in result) {
        setFeedback(result.error)
        return result
      }
      setFeedback(successMessage)
      router.refresh()
      return result
    } catch (error) {
      console.error('Task detail action failed', error)
      setFeedback('Terjadi kesalahan saat memproses permintaan. Silakan coba lagi.')
      return { error: 'Permintaan gagal.' }
    } finally {
      setBusy(false)
    }
  }

  function submitProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const progressPct = Number(formData.get('progressPct'))
    void runAction(
      () => updateTaskProgress({ taskId: task.id, progressPct }),
      'Progress berhasil diperbarui.',
    )
  }

  function submitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    void runAction(
      () =>
        addSupportRequest({
          taskId: task.id,
          neededFromId: String(formData.get('neededFromId') ?? ''),
          description: String(formData.get('description') ?? ''),
        }),
      'Permintaan support berhasil dikirim.',
    ).then((result) => {
        if ('data' in result) form.reset()
    })
  }

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    void runAction(
      () =>
        addComment({
          taskId: task.id,
          body: String(formData.get('body') ?? ''),
        }),
      'Komentar berhasil ditambahkan.',
    ).then((result) => {
      if ('data' in result) form.reset()
    })
  }

  function submitDeadlineChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const newDueDate = String(formData.get('newDueDate') ?? '')
    const reason = String(formData.get('reason') ?? '')
    if (!newDueDate) {
      setFeedback('Pilih deadline baru.')
      return
    }
    void runAction(
      () =>
        requestDeadlineChange({
          taskId: task.id,
          newDueDate: new Date(`${newDueDate}T00:00:00+07:00`).toISOString(),
          reason,
        }),
      currentUserRoleLevel >= 3
        ? 'Deadline berhasil diperbarui.'
        : 'Pengajuan perubahan deadline berhasil dikirim.',
    ).then((result) => {
      if ('data' in result) {
        setDeadlineDialogOpen(false)
        form.reset()
      }
    })
  }

  function submitEvidenceLink(event: FormEvent<HTMLFormElement>, requirementId: string) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    void runAction(
      () =>
        addEvidenceLink({
          requirementId,
          link: String(formData.get('link') ?? ''),
        }),
      'Tautan evidence berhasil disimpan.',
    ).then((result) => {
      if ('data' in result) form.reset()
    })
  }

  function submitEvidenceFile(event: FormEvent<HTMLFormElement>, requirementId: string) {
    event.preventDefault()
    const form = event.currentTarget
    const file = new FormData(form).get('file')
    if (!(file instanceof File) || file.size === 0) {
      setFeedback('Pilih file evidence terlebih dahulu.')
      return
    }
    void runAction(
      () => uploadTaskEvidence({ requirementId, file }),
      'Evidence berhasil diunggah.',
    ).then((result) => {
      if ('data' in result) form.reset()
    })
  }

  async function downloadEvidence(evidenceId: string) {
    const result = await runAction(
      () => getTaskEvidenceDownloadUrl(evidenceId),
      'Tautan unduhan siap digunakan.',
    )
    if ('data' in result && result.data.url) {
      setDownloadLinks((current) => ({ ...current, [evidenceId]: result.data.url ?? '' }))
    }
  }

  function submitReassignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const newOwnerId = String(data.get('newOwnerId') ?? '')
    const reason = String(data.get('reason') ?? '').trim()
    if (!newOwnerId || reason.length < 3) {
      setFeedback('Pilih PIC tujuan dan isi alasan pemindahan minimal 3 karakter.')
      return
    }
    void runAction(
      () => reassignTask({ taskId: task.id, newOwnerId, reason }),
      'Task berhasil dipindahkan dan riwayat pemindahan dicatat.',
    ).then((result) => { if ('data' in result) form.reset() })
  }

  const completedMandatoryEvidence = task.evidenceRequirements.filter(
    (requirement) => requirement.mandatory && requirement.evidenceFiles.length > 0,
  ).length
  const mandatoryEvidenceCount = task.evidenceRequirements.filter(
    (requirement) => requirement.mandatory,
  ).length

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/tasks" className="text-sm font-medium text-red-700 hover:underline">
            ← Kembali ke daftar task
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {task.title}
            </h1>
            <StatusBadge status={task.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{task.orgUnitName}</p>
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      {currentUserRoleLevel >= 3 && (
        <section aria-label="Kelola task" className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditOpen(!editOpen)} disabled={busy}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]">
              {editOpen ? 'Tutup edit' : 'Edit judul & prioritas'}
            </button>
          </div>
          {editOpen && (
            <form className="grid gap-3 sm:grid-cols-[1fr_160px_auto]" onSubmit={(event)=>{
              event.preventDefault()
              const formData=new FormData(event.currentTarget)
              void runAction(()=>updateTask({
                taskId:task.id, title:String(formData.get('title')??''),
                ownerId:task.ownerId, reviewerId:task.reviewerId,
                orgUnitId:task.orgUnitId, parentTaskId:task.parentTaskId,
                priority:String(formData.get('priority')??task.priority) as 'rendah'|'sedang'|'tinggi',
                startDate:task.startDate, dueDate:task.dueDate,
              }),'Task berhasil diperbarui.').then(result=>{if('data' in result)setEditOpen(false)})
            }}>
              <label className="text-xs text-[var(--color-text-secondary)]">Judul
                <input name="title" required maxLength={200} defaultValue={task.title} className={fieldClass} />
              </label>
              <label className="text-xs text-[var(--color-text-secondary)]">Prioritas
                <select name="priority" defaultValue={task.priority} className={fieldClass}>
                  <option value="rendah">Rendah</option><option value="sedang">Sedang</option><option value="tinggi">Tinggi</option>
                </select>
              </label>
              <button type="submit" disabled={busy} className={buttonClass}>Simpan</button>
            </form>
          )}
          <details>
            <summary className="cursor-pointer text-xs font-medium text-red-600">Hapus task (permanen)</summary>
            <p className="my-2 text-xs text-[var(--color-text-secondary)]">Ketik judul task persis untuk konfirmasi. Task yang mempunyai referensi terkait mungkin tidak dapat dihapus.</p>
            <div className="flex flex-wrap gap-2">
              <input aria-label="Ketik judul task untuk konfirmasi hapus" value={deleteConfirm}
                onChange={event=>setDeleteConfirm(event.target.value)} className={fieldClass} />
              <button type="button" disabled={busy||deleteConfirm!==task.title}
                onClick={()=>void runAction(()=>deleteTask(task.id),'Task dihapus.').then(result=>{
                  if('data' in result) {router.push('/tasks');router.refresh()}
                })}
                className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
                Hapus permanen
              </button>
            </div>
          </details>
        </section>
      )}

      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
        >
          {feedback}
        </p>
      )}

      {currentUserRoleLevel >= 3 && reassignmentOptions.length > 0 && (
        <section aria-label="Pindah PIC" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-900">Pindah PIC Task</h2>
          <p className="mt-1 text-sm text-slate-500">
            Pemindahan hanya diizinkan dalam cakupan organisasi Anda. Alasan wajib dicatat.
          </p>
          <form onSubmit={submitReassignment} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm font-medium text-slate-700">
              PIC tujuan
              <select name="newOwnerId" defaultValue="" required className={fieldClass} disabled={busy}>
                <option value="" disabled>Pilih PIC</option>
                {reassignmentOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>{owner.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Alasan pemindahan
              <input name="reason" type="text" minLength={3} maxLength={500} required
                className={fieldClass} disabled={busy} placeholder="Jelaskan alasan pindah PIC" />
            </label>
            <button type="submit" className={buttonClass} disabled={busy}>Pindah PIC</button>
          </form>
        </section>
      )}

      {task.isOverdue && task.status !== 'Done' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Task ini telah melewati tenggat.
        </div>
      )}

      <section
        aria-label="Informasi task"
        className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5"
      >
        <Metadata label="PIC" value={task.ownerName} />
        <Metadata label="Dibuat oleh" value={task.assignerName} />
        <Metadata label="Mulai" value={formatDate(task.startDate)} />
        <Metadata label="Tenggat" value={formatDate(task.dueDate)} />
        <Metadata label="Reviewer" value={task.reviewerName ?? 'Belum ditentukan'} />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Progress</p>
          <div className="mt-2">
            <ProgressBar value={task.progressPct} />
          </div>
        </div>
      </section>

      {currentUserRoleLevel >= 3 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Tanggal mulai</h2>
              <p className="mt-1 text-xs text-slate-500">Perubahan langsung tersedia untuk Manager+ dalam cakupan. Tanggal mulai harus sebelum tenggat.</p>
            </div>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const form = event.currentTarget
                const startDate = String(new FormData(form).get('startDate') ?? '')
                void runAction(
                  () => updateTaskStartDate({ taskId: task.id, startDate }),
                  'Tanggal mulai berhasil diperbarui.',
                )
              }}
            >
              <label className="text-xs font-medium text-slate-600">
                Tanggal mulai baru
                <input className={fieldClass} type="date" name="startDate" defaultValue={task.startDate.slice(0, 10)} max={task.dueDate.slice(0, 10)} required />
              </label>
              <button className={buttonClass} disabled={busy} type="submit">Simpan</button>
            </form>
          </div>
        </section>
      )}

      {isOwner && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Perbarui progress</h2>
          <form onSubmit={submitProgress} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-700">
              Progress (%)
              <input
                className={fieldClass}
                type="number"
                name="progressPct"
                min={0}
                max={100}
                step={1}
                defaultValue={task.progressPct}
                required
              />
            </label>
            <button className={buttonClass} disabled={busy} type="submit">
              Simpan progress
            </button>
          </form>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7">
          <h2 className="text-sm font-semibold text-slate-900">WBS dan Timeline</h2>
          {task.wbsItems.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Belum ada rincian WBS untuk task ini.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {task.wbsItems.map((item) => (
                <li key={item.id} className="flex items-start gap-3 text-sm">
                  {isOwner && ['To do', 'In progress', 'Revisi'].includes(task.status) ? (
                    <input type="checkbox" aria-label={`Tandai WBS ${item.title} selesai`} checked={item.isDone}
                      disabled={busy} onChange={(event) => void runAction(
                        () => toggleWbsItem(item.id, event.target.checked, task.id),
                        'Status WBS dan progress diperbarui.'
                      )}
                      className="mt-0.5 h-4 w-4 accent-emerald-600" />
                  ) : (
                    <span aria-label={item.isDone ? 'Selesai' : 'Belum selesai'}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${item.isDone ? 'border-green-600 bg-green-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {item.isDone ? '✓' : ''}
                    </span>
                  )}
                  <span className={item.isDone ? 'text-slate-400 line-through' : 'text-slate-800'}>
                    {item.title}
                  </span>
                  <span className="ml-auto text-xs text-slate-400">{item.weight}%</span>
                </li>
              ))}
            </ul>
          )}
          {isOwner && ['To do', 'In progress', 'Revisi'].includes(task.status) && (
            <form className="mt-5 grid gap-2 border-t border-[var(--color-border)] pt-4 sm:grid-cols-[1fr_100px_auto]"
              onSubmit={(event) => {
                event.preventDefault()
                const form = event.currentTarget
                const data = new FormData(form)
                void runAction(() => addWbsItem(task.id, String(data.get('wbsTitle') ?? ''), Number(data.get('wbsWeight'))),
                  'WBS berhasil ditambahkan.').then(result => { if ('data' in result) form.reset() })
              }}>
              <input name="wbsTitle" required maxLength={200} placeholder="Langkah pekerjaan" aria-label="Judul WBS"
                className={fieldClass} />
              <input name="wbsWeight" required type="number" min="1" max="100" step="1" placeholder="Bobot %" aria-label="Bobot WBS"
                className={fieldClass} />
              <button disabled={busy} type="submit" className={buttonClass}>Tambah WBS</button>
            </form>
          )}
          {isOwner && (
            <p className="mt-4 text-xs text-slate-500">
              Centang WBS yang selesai untuk menghitung progress berdasarkan bobot pekerjaan.
            </p>
          )}
        </section>

        <div className="space-y-5 lg:col-span-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Support yang dibutuhkan</h2>
            {task.supports.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Belum ada permintaan support.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {task.supports.map((support) => (
                  <li
                    key={support.id}
                    className="flex flex-col gap-2 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{support.description}</p>
                      <p className="mt-1 text-xs text-slate-500">Diminta dari {support.neededFromName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          support.status === 'diberikan'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {support.status === 'diberikan' ? 'Diberikan' : 'Diminta'}
                      </span>
                      {support.status === 'diminta' && support.neededFromId === currentUserId && (
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              () => markSupportProvided({ supportId: support.id }),
                              'Support ditandai telah diberikan.',
                            )
                          }
                          type="button"
                        >
                          Tandai diberikan
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {isOwner && supportRecipients.length > 0 && (
              <form onSubmit={submitSupport} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <label className="block text-sm text-slate-700">
                  Minta bantuan dari
                  <select name="neededFromId" className={fieldClass} required defaultValue="">
                    <option value="" disabled>Pilih user aktif</option>
                    {supportRecipients.map((recipient) => (
                      <option key={recipient.id} value={recipient.id}>{recipient.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-slate-700">
                  Bantuan yang dibutuhkan
                  <textarea name="description" className={fieldClass} rows={2} required maxLength={1000} />
                </label>
                <button className={buttonClass} disabled={busy} type="submit">
                  Kirim permintaan support
                </button>
              </form>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Evidence wajib
              <span className="ml-2 font-normal text-slate-500">
                ({completedMandatoryEvidence} dari {mandatoryEvidenceCount})
              </span>
            </h2>
            {task.evidenceRequirements.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Tidak ada evidence yang disyaratkan.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {task.evidenceRequirements.map((requirement) => (
                  <li key={requirement.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start gap-2 text-sm">
                      <span
                        aria-label={requirement.evidenceFiles.length ? 'Evidence tersedia' : 'Evidence belum tersedia'}
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          requirement.evidenceFiles.length
                            ? 'border-green-600 bg-green-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {requirement.evidenceFiles.length ? '✓' : ''}
                      </span>
                      <span className="font-medium text-slate-800">
                        {requirement.description}
                        {!requirement.mandatory && (
                          <span className="ml-2 text-xs font-normal text-slate-500">Opsional</span>
                        )}
                      </span>
                    </div>
                    {requirement.evidenceFiles.length > 0 && (
                      <ul className="ml-6 mt-2 space-y-2">
                        {requirement.evidenceFiles.map((evidence) => (
                          <li key={evidence.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="text-slate-500">
                              Diunggah {formatDate(evidence.uploadedAt)} oleh {evidence.uploaderName}
                            </span>
                            {evidence.externalUrl ? (
                              <a
                                className="font-medium text-red-700 underline"
                                href={evidence.externalUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                Buka tautan
                              </a>
                            ) : (
                              <>
                                <button
                                  className="font-medium text-red-700 underline disabled:opacity-60"
                                  disabled={busy}
                                  onClick={() => void downloadEvidence(evidence.id)}
                                  type="button"
                                >
                                  Siapkan unduhan
                                </button>
                                {downloadLinks[evidence.id] && (
                                  <a
                                    className="font-medium text-red-700 underline"
                                    href={downloadLinks[evidence.id]}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    Unduh file
                                  </a>
                                )}
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {isOwner && (
                      <div className="ml-6 mt-3 grid gap-3">
                        <form
                          onSubmit={(event) => submitEvidenceFile(event, requirement.id)}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <label className="min-w-0 flex-1 text-xs text-slate-600">
                            Unggah file (PDF, JPG, PNG, CSV; maks. 20 MB)
                            <input
                              className="mt-1 block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2"
                              type="file"
                              name="file"
                              accept=".pdf,.jpg,.jpeg,.png,.csv"
                              required
                            />
                          </label>
                          <button className="rounded border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-60" disabled={busy} type="submit">
                            Unggah
                          </button>
                        </form>
                        <form
                          onSubmit={(event) => submitEvidenceLink(event, requirement.id)}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <label className="min-w-0 flex-1 text-xs text-slate-600">
                            Atau tautan HTTPS
                            <input className={fieldClass} type="url" name="link" placeholder="https://" required />
                          </label>
                          <button className="rounded border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-60" disabled={busy} type="submit">
                            Simpan tautan
                          </button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Perubahan status</h2>
        {statusActions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {statusActions.map((status) => (
              <button
                className={buttonClass}
                disabled={busy}
                key={status}
                onClick={() =>
                  void runAction(
                    () => updateTaskStatus({ taskId: task.id, status }),
                    `Status task berhasil diubah menjadi ${status}.`,
                  )
                }
                type="button"
              >
                {status === 'Review' ? 'Ajukan review' : `Ubah ke ${status}`}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Tidak ada perubahan status yang dapat dilakukan pada tahap ini.
          </p>
        )}
        {(task.status === 'Review' && (isReviewer || canReviewOwnTask)) && (
          <Link
            className={`${buttonClass} mt-3 inline-flex`}
            href={`/tasks/${task.id}/review`}
          >
            {canReviewOwnTask ? 'Review pekerjaan sendiri' : 'Buka layar review'}
          </Link>
        )}
        {canChangeDeadline && (
          <button
            className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={busy}
            onClick={() => {
              setMinimumDeadlineDate(dateInputValue(new Date(Date.now() + 86_400_000)))
              setDeadlineDialogOpen(true)
            }}
            type="button"
          >
            {currentUserRoleLevel >= 3 ? 'Ubah deadline' : 'Ajukan perubahan deadline'}
          </button>
        )}
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Riwayat progress</h2>
          {task.progressHistory.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Belum ada perubahan progress.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {task.progressHistory.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-3 text-sm">
                  <span>{entry.changedByName} memperbarui progress menjadi {entry.progressPct}%</span>
                  <time className="shrink-0 text-xs text-slate-500">{formatDate(entry.changedAt, true)}</time>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Riwayat perubahan tenggat</h2>
          {task.deadlineRequests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Belum ada pengajuan perubahan tenggat.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {task.deadlineRequests.map((request) => (
                <li key={request.id} className="border-b border-slate-100 pb-3 text-sm last:border-0">
                  <p className="font-medium">
                    {formatDate(request.oldDueDate)} → {formatDate(request.newDueDate)}
                    <span className="ml-2 text-xs font-normal text-slate-500">{request.status}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{request.reason}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Diajukan {request.requestedByName}
                    {request.approverName ? ` · Diputuskan ${request.approverName}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Komentar</h2>
        {task.comments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Belum ada komentar.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {task.comments.map((comment) => (
              <li key={comment.id} className="border-b border-slate-100 pb-3 last:border-0">
                <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{comment.userName}</span>
                  <time>{formatDate(comment.createdAt, true)}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
              </li>
            ))}
          </ol>
        )}
        <form onSubmit={submitComment} className="mt-4 space-y-3">
          <label className="block text-sm text-slate-700">
            Tambahkan komentar
            <textarea className={fieldClass} name="body" rows={3} maxLength={5000} required />
          </label>
          <button className={buttonClass} disabled={busy} type="submit">Kirim komentar</button>
        </form>
      </section>
      {deadlineDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setDeadlineDialogOpen(false)
          }}
        >
          <section
            aria-labelledby="deadline-dialog-title"
            aria-modal="true"
            className="w-full max-w-xl rounded-xl border border-slate-100 bg-white shadow-2xl"
            role="dialog"
          >
            <header className="flex items-start justify-between px-6 pt-6">
              <div>
                <h2 id="deadline-dialog-title" className="text-lg font-bold text-slate-900">
                  {currentUserRoleLevel >= 3 ? 'Ubah Deadline' : 'Ajukan Perubahan Deadline'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{task.title}</p>
              </div>
              <button
                aria-label="Tutup dialog"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                disabled={busy}
                onClick={() => setDeadlineDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <form className="space-y-4 px-6 py-5" onSubmit={submitDeadlineChange}>
              <label className="block text-sm font-medium text-slate-700">
                Deadline saat ini
                <input
                  className={`${fieldClass} bg-slate-100`}
                  disabled
                  value={formatDate(task.dueDate)}
                  readOnly
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Deadline baru <span className="text-red-600">*</span>
                <input
                  className={fieldClass}
                  min={minimumDeadlineDate}
                  name="newDueDate"
                  required
                  type="date"
                />
              </label>
              {currentUserRoleLevel < 3 && (
                <label className="block text-sm font-medium text-slate-700">
                  Alasan <span className="text-red-600">*</span>
                  <textarea
                    className={fieldClass}
                    maxLength={1000}
                    minLength={1}
                    name="reason"
                    required
                    rows={3}
                  />
                </label>
              )}
              <p className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                {currentUserRoleLevel >= 3
                  ? 'Perubahan deadline langsung tercatat pada audit log.'
                  : 'Deadline baru berlaku setelah disetujui SM, GM, atau Super Admin.'}
              </p>
              <footer className="flex justify-end gap-3">
                <button
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  disabled={busy}
                  onClick={() => setDeadlineDialogOpen(false)}
                  type="button"
                >
                  Batal
                </button>
                <button className={buttonClass} disabled={busy} type="submit">
                  {busy ? 'Menyimpan…' : 'Kirim'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}
