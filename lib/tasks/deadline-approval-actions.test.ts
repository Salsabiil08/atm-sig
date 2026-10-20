import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionUser, requireRole, createClient, createAdminClient, revalidatePath, rpc, auditInsert } =
  vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    requireRole: vi.fn(),
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
    revalidatePath: vi.fn(),
    rpc: vi.fn(),
    auditInsert: vi.fn(),
  }))

vi.mock('@/lib/auth/session', () => ({ getSessionUser, requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('next/cache', () => ({ revalidatePath }))

import { approveDeadlineChange } from './actions'

const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

describe('approveDeadlineChange (FR-061, FR-062)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionUser.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'sm@example.test',
      name: 'SM',
      role: 'SM',
      roleLevel: 4,
      orgUnitId: 2,
      supervisorId: null,
    })
    rpc.mockResolvedValue({ data: requestId, error: null })
    auditInsert.mockResolvedValue({ error: null })
    createClient.mockResolvedValue({ rpc })
    createAdminClient.mockReturnValue({
      from: vi.fn(() => ({ insert: auditInsert })),
    })
  })

  it('uses the atomic database procedure and records the decision', async () => {
    const result = await approveDeadlineChange({ requestId, decision: 'Disetujui' })

    expect(result).toEqual({ data: { success: true } })
    expect(rpc).toHaveBeenCalledWith('decide_deadline_change', {
      p_request_id: requestId,
      p_decision: 'Disetujui',
    })
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'approve_deadline',
      object: `deadline_change_requests:${requestId}`,
      old_value: 'Menunggu approval',
      new_value: 'Disetujui',
    }))
    expect(revalidatePath).toHaveBeenCalledWith('/approvals')
    expect(revalidatePath).toHaveBeenCalledWith('/tasks')
  })

  it('rejects malformed request ids before calling Supabase', async () => {
    const result = await approveDeadlineChange({
      requestId: 'bad-id',
      decision: 'Ditolak',
    })

    expect(result).toEqual({ error: 'ID permohonan perubahan deadline tidak valid.' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns a clear failure when the request is no longer actionable', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('Already decided') })

    const result = await approveDeadlineChange({ requestId, decision: 'Ditolak' })

    expect(result).toEqual({
      error: 'Permohonan tidak ditemukan, sudah diproses, atau berada di luar cakupan Anda.',
    })
    expect(auditInsert).not.toHaveBeenCalled()
  })
})
