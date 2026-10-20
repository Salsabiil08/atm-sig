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

import { updateTaskProgress } from './actions'

const taskId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('updateTaskProgress (FR-025, BR-010)', () => {
  let taskQuery: {
    select: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
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
      update: vi.fn(() => taskQuery),
      eq: vi.fn(() => taskQuery),
      maybeSingle: vi.fn(),
    }
    createClient.mockResolvedValue({ from: vi.fn(() => taskQuery) })
  })

  it('updates progress for the PIC and refreshes dependent views', async () => {
    taskQuery.maybeSingle
      .mockResolvedValueOnce({ data: { id: taskId, owner_id: ownerId }, error: null })
      .mockResolvedValueOnce({ data: { id: taskId }, error: null })

    const result = await updateTaskProgress({ taskId, progressPct: 42 })

    expect(result).toEqual({ data: { success: true } })
    expect(taskQuery.update).toHaveBeenCalledWith({ progress_pct: 42 })
    expect(revalidatePath).toHaveBeenCalledWith(`/tasks/${taskId}`)
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it.each([-1, 101, 10.5, Number.NaN])('rejects invalid progress %s before querying', async (progressPct) => {
    const result = await updateTaskProgress({ taskId, progressPct })

    expect(result).toEqual({ error: 'Progress harus berupa bilangan bulat dari 0 sampai 100.' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('rejects updates from a user who is not the task PIC', async () => {
    taskQuery.maybeSingle.mockResolvedValueOnce({
      data: { id: taskId, owner_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
      error: null,
    })

    const result = await updateTaskProgress({ taskId, progressPct: 50 })

    expect(result).toEqual({ error: 'Hanya PIC task yang dapat memperbarui progress.' })
    expect(taskQuery.update).not.toHaveBeenCalled()
  })
})
