// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { refresh, updateTaskStatus } = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateTaskStatus: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/tasks/actions', () => ({ updateTaskStatus }))

import KanbanBoard from './KanbanBoard'
import type { SessionUser } from '@/lib/auth/session'
import type { TaskListItem } from '@/lib/tasks/queries'

const ownerId = '11111111-1111-4111-8111-111111111111'
const managerId = '22222222-2222-4222-8222-222222222222'
const reviewerId = '44444444-4444-4444-8444-444444444444'
const task: TaskListItem = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Rekonsiliasi bulanan',
  status: 'To do',
  priority: 'tinggi',
  progressPct: 20,
  startDate: '2026-10-01T00:00:00.000Z',
  dueDate: '2026-10-31T00:00:00.000Z',
  completedAt: null,
  timePct: 45,
  isOverdue: false,
  ownerName: 'PIC Accounting',
  ownerId,
  reviewerId,
  assignerName: 'SM Accounting',
  reviewerName: 'Manager Accounting',
  orgUnitName: 'Accounting',
  createdAt: '2026-10-01T00:00:00.000Z',
}

function user(id: string, role: SessionUser['role'], roleLevel: number): SessionUser {
  return {
    id, email: 'user@example.test', name: 'User', role, roleLevel,
    orgUnitId: 4, supervisorId: null,
  }
}

describe('Kanban role transitions (FR-110, BR-080)', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    updateTaskStatus.mockResolvedValue({ data: { success: true } })
  })

  it('offers the same legal ordinary transition to a scoped manager who is not the owner', () => {
    render(<KanbanBoard tasks={[task]} user={user(managerId, 'Manager', 3)} />)

    expect(screen.getByRole('button', { name: /In progress/ })).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Progress Rekonsiliasi bulanan' })).toBeTruthy()
  })

  it('keeps Spectator read-only and sends a manager move through the server action', async () => {
    const { rerender } = render(<KanbanBoard tasks={[task]} user={user(managerId, 'Spectator', 1)} />)
    expect(screen.queryByRole('button', { name: /In progress/ })).toBeNull()

    rerender(<KanbanBoard tasks={[task]} user={user(managerId, 'Manager', 3)} />)
    fireEvent.click(screen.getByRole('button', { name: /In progress/ }))

    await waitFor(() => expect(updateTaskStatus).toHaveBeenCalledWith({ taskId: task.id, status: 'In progress' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('shows the dedicated review route instead of Kanban approval buttons', () => {
    render(<KanbanBoard tasks={[{ ...task, status: 'Review' }]} user={user(reviewerId, 'Manager', 3)} />)

    expect(screen.queryByRole('button', { name: /Done|Revisi/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Buka review' }).getAttribute('href')).toBe(`/tasks/${task.id}/review`)
  })

  it('routes GM and Super Admin owners to the self-review flow with rejection comments', () => {
    render(<KanbanBoard tasks={[{ ...task, status: 'Review', reviewerId: null }]} user={user(ownerId, 'GM', 5)} />)

    expect(screen.queryByRole('button', { name: /Revisi/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Review sendiri' }).getAttribute('href')).toBe(`/tasks/${task.id}/review`)
  })
})
