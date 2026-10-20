// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TaskDetailClient from './TaskDetailClient'
import type { TaskDetail } from '@/lib/tasks/queries'

const { router, actions } = vi.hoisted(() => ({
  router: { refresh: vi.fn() },
  actions: {
    addComment: vi.fn(),
    addEvidenceLink: vi.fn(),
    addSupportRequest: vi.fn(),
    getTaskEvidenceDownloadUrl: vi.fn(),
    markSupportProvided: vi.fn(),
    requestDeadlineChange: vi.fn(),
    updateTaskStartDate: vi.fn(),
    updateTaskProgress: vi.fn(),
    updateTaskStatus: vi.fn(),
    uploadTaskEvidence: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/lib/tasks/actions', () => actions)

const task: TaskDetail = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  title: 'Rekonsiliasi bank',
  status: 'To do',
  priority: 'sedang',
  progressPct: 0,
  startDate: '2026-10-20',
  dueDate: '2026-10-30',
  completedAt: null,
  timePct: 0,
  isOverdue: false,
  ownerName: 'Sari',
  ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  reviewerId: null,
  assignerName: 'Maya',
  reviewerName: null,
  orgUnitName: 'Accounting',
  createdAt: '2026-10-20T00:00:00.000Z',
  parentTaskId: null,
  wbsItems: [],
  progressHistory: [],
  evidenceRequirements: [{
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    description: 'Laporan rekonsiliasi',
    mandatory: true,
    evidenceFiles: [{
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        externalUrl: null,
      uploadedAt: '2026-10-20T00:00:00.000Z',
      uploaderName: 'Sari',
    }],
  }],
  comments: [],
  supports: [],
  deadlineRequests: [],
}

describe('TaskDetailClient (docs/07 #6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actions.updateTaskProgress.mockResolvedValue({ data: { success: true } })
    actions.updateTaskStatus.mockResolvedValue({ data: { success: true } })
    actions.requestDeadlineChange.mockResolvedValue({ data: { success: true, direct: false } })
    actions.updateTaskStartDate.mockResolvedValue({ data: { success: true } })
    actions.getTaskEvidenceDownloadUrl.mockResolvedValue({
      data: { url: 'https://storage.example.test/signed-download' },
    })
  })

  afterEach(cleanup)

  it('renders the detail and lets the PIC update progress', async () => {
    render(
      <TaskDetailClient
        task={task}
        currentUserId={task.ownerId}
        currentUserRoleLevel={2}
        supportRecipients={[]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Rekonsiliasi bank' })).toBeTruthy()
    expect(screen.getByText('Evidence wajib')).toBeTruthy()
    expect(screen.queryByText(/cccccccc-cccc/)).toBeNull()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Progress (%)' }), {
      target: { value: '35' },
    })
    fireEvent.submit(screen.getByRole('spinbutton', { name: 'Progress (%)' }).closest('form')!)

    await waitFor(() => {
      expect(actions.updateTaskProgress).toHaveBeenCalledWith({
        taskId: task.id,
        progressPct: 35,
      })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ubah ke In progress' }))
    await waitFor(() => {
      expect(actions.updateTaskStatus).toHaveBeenCalledWith({
        taskId: task.id,
        status: 'In progress',
      })
    })
    expect(router.refresh).toHaveBeenCalledTimes(2)
  })

  it('does not show PIC controls to other users and only exposes a signed file link after requesting it', async () => {
    render(
      <TaskDetailClient
        task={task}
        currentUserId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
        currentUserRoleLevel={2}
        supportRecipients={[]}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Simpan progress' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Simpan progress' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Siapkan unduhan' }))

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Unduh file' })).toBeDefined()
    })
    expect(actions.getTaskEvidenceDownloadUrl).toHaveBeenCalledWith(
      task.evidenceRequirements[0].evidenceFiles[0].id,
    )
  })

  it('lets the PIC submit a deadline request with a reason', async () => {
    render(
      <TaskDetailClient
        task={task}
        currentUserId={task.ownerId}
        currentUserRoleLevel={2}
        supportRecipients={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ajukan perubahan deadline' }))
    fireEvent.change(screen.getByLabelText(/Deadline baru/), {
      target: { value: '2099-12-31' },
    })
    fireEvent.change(screen.getByLabelText(/Alasan/), {
      target: { value: 'Menunggu data pendukung' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Kirim' }).closest('form')!)

    await waitFor(() => {
      expect(actions.requestDeadlineChange).toHaveBeenCalledWith({
        taskId: task.id,
        newDueDate: '2099-12-30T17:00:00.000Z',
        reason: 'Menunggu data pendukung',
      })
    })
    expect(router.refresh).toHaveBeenCalled()
  })

  it('lets a Manager change the start date directly and hides that control from a PIC', async () => {
    const { unmount } = render(
      <TaskDetailClient
        task={task}
        currentUserId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
        currentUserRoleLevel={3}
        supportRecipients={[]}
      />,
    )
    const startDate = screen.getByLabelText('Tanggal mulai baru')
    fireEvent.change(startDate, { target: { value: '2026-10-22' } })
    fireEvent.submit(startDate.closest('form')!)
    await waitFor(() => {
      expect(actions.updateTaskStartDate).toHaveBeenCalledWith({
        taskId: task.id,
        startDate: '2026-10-22',
      })
    })

    unmount()
    render(
      <TaskDetailClient
        task={task}
        currentUserId={task.ownerId}
        currentUserRoleLevel={2}
        supportRecipients={[]}
      />,
    )
    expect(screen.queryByLabelText('Tanggal mulai baru')).toBeNull()
  })

  it('shows the review screen link only to the assigned reviewer while in Review', () => {
    const reviewTask = {
      ...task,
      status: 'Review' as const,
      reviewerId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    }
    render(
      <TaskDetailClient
        task={reviewTask}
        currentUserId={reviewTask.reviewerId}
        currentUserRoleLevel={3}
        supportRecipients={[]}
      />,
    )

    expect(screen.getByRole('link', { name: 'Buka layar review' }).getAttribute('href'))
      .toBe(`/tasks/${task.id}/review`)
  })

  it('allows a GM task owner without a reviewer to open self-review and finish without evidence', () => {
    const ownerId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    const privilegedTask = {
      ...task,
      status: 'Review' as const,
      ownerId,
      reviewerId: null,
      evidenceRequirements: [{
        ...task.evidenceRequirements[0],
        evidenceFiles: [],
      }],
    }
    render(
      <TaskDetailClient
        task={privilegedTask}
        currentUserId={ownerId}
        currentUserRoleLevel={5}
        supportRecipients={[]}
      />,
    )

    expect(screen.getByRole('link', { name: 'Review pekerjaan sendiri' })
      .getAttribute('href')).toBe(`/tasks/${task.id}/review`)
    expect(screen.getByRole('button', { name: 'Ubah ke Done' })).toBeTruthy()
  })
})
