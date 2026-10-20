import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionUser, createClient, revalidatePath } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  createClient: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ getSessionUser }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
  AdminConfigurationError: class AdminConfigurationError extends Error {},
}))
vi.mock('next/cache', () => ({ revalidatePath }))

import { requestDeadlineChange } from './actions'

const taskId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const task = {
  id: taskId,
  owner_id: ownerId,
  due_date: '2026-11-01T00:00:00.000Z',
  status: 'In progress',
  org_unit_id: 4,
}

describe('requestDeadlineChange (FR-060, BR-040)', () => {
  let taskQuery: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  let requestQuery: {
    insert: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getSessionUser.mockResolvedValue({
      id: ownerId,
      email: 'pic@example.test',
      name: 'PIC',
      role: 'Staff/PIC',
      roleLevel: 2,
      orgUnitId: 4,
      supervisorId: null,
    })
    taskQuery = {
      select: vi.fn(() => taskQuery),
      eq: vi.fn(() => taskQuery),
      maybeSingle: vi.fn().mockResolvedValue({ data: task, error: null }),
      update: vi.fn(() => taskQuery),
    }
    requestQuery = { insert: vi.fn().mockResolvedValue({ error: null }) }
    createClient.mockResolvedValue({
      from: vi.fn((table: string) => table === 'tasks' ? taskQuery : requestQuery),
    })
  })

  it('creates a pending request for the PIC without changing the task deadline', async () => {
    const newDueDate = new Date(Date.now() + 5 * 86_400_000).toISOString()
    const result = await requestDeadlineChange({
      taskId,
      newDueDate,
      reason: '  Menunggu konfirmasi bank  ',
    })

    expect(result).toEqual({ data: { success: true, direct: false } })
    expect(requestQuery.insert).toHaveBeenCalledWith({
      task_id: taskId,
      requested_by: ownerId,
      old_due_date: task.due_date,
      new_due_date: new Date(newDueDate).toISOString(),
      reason: 'Menunggu konfirmasi bank',
      status: 'Menunggu approval',
    })
    expect(taskQuery.update).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith(`/tasks/${taskId}`)
  })

  it('lets Manager or higher change a deadline directly without creating an approval request', async () => {
    getSessionUser.mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      email: 'manager@example.test',
      name: 'Manager',
      role: 'Manager',
      roleLevel: 3,
      orgUnitId: 4,
      supervisorId: null,
    })
    const newDueDate = new Date(Date.now() + 5 * 86_400_000).toISOString()

    const result = await requestDeadlineChange({
      taskId,
      newDueDate,
      reason: '',
    })

    expect(result).toEqual({ data: { success: true, direct: true } })
    expect(taskQuery.update).toHaveBeenCalledWith({
      due_date: new Date(newDueDate).toISOString(),
    })
    expect(requestQuery.insert).not.toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith(`/tasks/${taskId}`)
    expect(revalidatePath).toHaveBeenCalledWith('/tasks')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it.each([
    { newDueDate: 'not-a-date', reason: 'alasan' },
    { newDueDate: '2000-01-01T00:00:00.000Z', reason: 'alasan' },
    { newDueDate: new Date(Date.now() + 86_400_000).toISOString(), reason: '  ' },
    { newDueDate: new Date(Date.now() + 86_400_000).toISOString(), reason: 'x'.repeat(1001) },
  ])('rejects invalid or incomplete request data before insert', async ({ newDueDate, reason }) => {
    const result = await requestDeadlineChange({ taskId, newDueDate, reason })

    expect('error' in result).toBe(true)
    expect(requestQuery.insert).not.toHaveBeenCalled()
  })

  it('rejects requests from a non-owner PIC', async () => {
    getSessionUser.mockResolvedValue({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      role: 'Staff/PIC',
      roleLevel: 2,
    })

    const result = await requestDeadlineChange({
      taskId,
      newDueDate: new Date(Date.now() + 86_400_000).toISOString(),
      reason: 'Tolong perpanjang',
    })

    expect(result).toEqual({ error: 'Hanya PIC task yang dapat mengajukan perubahan deadline.' })
    expect(requestQuery.insert).not.toHaveBeenCalled()
  })
})
