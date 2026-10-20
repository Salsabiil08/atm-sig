// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReviewTaskClient from './ReviewTaskClient'
import type { TaskDetail } from '@/lib/tasks/queries'

const { router, reviewTask, getTaskEvidenceDownloadUrl } = vi.hoisted(() => ({
  router: { push: vi.fn(), refresh: vi.fn() },
  reviewTask: vi.fn(),
  getTaskEvidenceDownloadUrl: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/lib/tasks/actions', () => ({ reviewTask, getTaskEvidenceDownloadUrl }))

const task: TaskDetail = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  title: 'Rekap verifikasi mingguan',
  status: 'Review',
  priority: 'sedang',
  progressPct: 100,
  startDate: '2026-10-20',
  dueDate: '2026-10-30',
  completedAt: null,
  timePct: 100,
  isOverdue: false,
  ownerName: 'Wulan',
  ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  reviewerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  assignerName: 'Maya',
  reviewerName: 'Maya',
  orgUnitName: 'Accounting',
  createdAt: '2026-10-20T00:00:00.000Z',
  parentTaskId: null,
  wbsItems: [],
  progressHistory: [],
  evidenceRequirements: [{
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    description: 'Laporan verifikasi',
    mandatory: true,
    evidenceFiles: [{
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      externalUrl: null,
      uploadedAt: '2026-10-20T00:00:00.000Z',
      uploaderName: 'Wulan',
    }],
  }],
  comments: [],
  supports: [],
  deadlineRequests: [],
}

describe('ReviewTaskClient (docs/07 #9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reviewTask.mockResolvedValue({ data: { success: true } })
    getTaskEvidenceDownloadUrl.mockResolvedValue({ data: { url: 'https://example.test/evidence' } })
  })

  afterEach(cleanup)

  it('requires a comment for rejection and submits approval through the review action', async () => {
    render(<ReviewTaskClient task={task} />)

    fireEvent.click(screen.getByRole('button', { name: 'Tolak (Revisi)' }))
    expect(screen.getByRole('status').textContent).toMatch(/Komentar wajib/)
    expect(reviewTask).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Komentar reviewer'), {
      target: { value: 'Lengkapi bukti rekonsiliasi.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Setujui (Done)' }))

    await waitFor(() => {
      expect(reviewTask).toHaveBeenCalledWith({
        taskId: task.id,
        decision: 'Done',
        comment: 'Lengkapi bukti rekonsiliasi.',
      })
    })
    expect(router.push).toHaveBeenCalledWith(`/tasks/${task.id}`)
  })

  it('uses a signed download link for private evidence', async () => {
    render(<ReviewTaskClient task={task} />)
    fireEvent.click(screen.getByRole('button', { name: 'Siapkan unduhan' }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Unduh file' }).getAttribute('href'))
        .toBe('https://example.test/evidence')
    })
    expect(getTaskEvidenceDownloadUrl).toHaveBeenCalledWith(task.evidenceRequirements[0].evidenceFiles[0].id)
  })
})
