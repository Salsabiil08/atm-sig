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

import { reassignTask } from './actions'

const taskId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const newOwnerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const reassignmentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

describe('reassignTask (FR-030, FR-031, BR-050, BR-051)', () => {
  let rpc: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    getSessionUser.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'manager@example.test',
      name: 'Manager',
      role: 'Manager',
      roleLevel: 3,
      orgUnitId: 4,
      supervisorId: null,
    })
    rpc = vi.fn().mockResolvedValue({ data: reassignmentId, error: null })
    createClient.mockResolvedValue({ rpc })
  })

  it('calls the atomic scoped RPC and refreshes task and notification views', async () => {
    const result = await reassignTask({
      taskId,
      newOwnerId,
      reason: '  Redistribute workload  ',
    })

    expect(result).toEqual({ data: { reassignmentId } })
    expect(rpc).toHaveBeenCalledWith('reassign_task', {
      p_task_id: taskId,
      p_new_owner_id: newOwnerId,
      p_reason: 'Redistribute workload',
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/tasks/${taskId}`)
    expect(revalidatePath).toHaveBeenCalledWith('/notifications')
  })

  it('rejects missing transfer information before calling Supabase', async () => {
    const result = await reassignTask({ taskId, newOwnerId, reason: '  ' })

    expect(result).toEqual({
      error: 'Task, PIC tujuan, dan alasan pemindahan wajib diisi dengan benar.',
    })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns a clear failure when the database rejects transfer scope', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('scope denied') })

    const result = await reassignTask({ taskId, newOwnerId, reason: 'Outside scope' })

    expect(result).toEqual({
      error: 'Pemindahan task ditolak atau gagal. Periksa cakupan, PIC tujuan, dan alasannya.',
    })
  })
})
