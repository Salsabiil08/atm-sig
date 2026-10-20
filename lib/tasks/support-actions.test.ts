import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionUser, createClient, createAdminClient, revalidatePath } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({
  getSessionUser,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
vi.mock('next/cache', () => ({ revalidatePath }))

import { addSupportRequest, markSupportProvided } from './actions'

const taskId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const recipientId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const supportId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

function createQuery(initialResults: unknown[] = []) {
  let nextResult = 0
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    update: vi.fn(() => query),
    maybeSingle: vi.fn(async () => initialResults[nextResult++]),
    insert: vi.fn(async () => ({ error: null })),
  }
  return query
}

describe('Task support actions (FR-022, BR-002)', () => {
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
  })

  it('lets the task owner request support from an active user', async () => {
    const taskQuery = createQuery([{ data: { owner_id: ownerId }, error: null }])
    const userQuery = createQuery([{ data: { id: recipientId, status: 'aktif' }, error: null }])
    const supportQuery = createQuery()
    createClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'tasks') return taskQuery
        if (table === 'users') return userQuery
        return supportQuery
      }),
    })

    const result = await addSupportRequest({
      taskId,
      neededFromId: recipientId,
      description: '  Review the reconciliation  ',
    })

    expect(result).toEqual({ data: { success: true } })
    expect(supportQuery.insert).toHaveBeenCalledWith({
      task_id: taskId,
      needed_from_id: recipientId,
      description: 'Review the reconciliation',
      status: 'diminta',
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/tasks/${taskId}`)
  })

  it('rejects empty support descriptions before querying Supabase', async () => {
    const result = await addSupportRequest({
      taskId,
      neededFromId: recipientId,
      description: '  ',
    })

    expect(result).toEqual({ error: 'Jelaskan support yang dibutuhkan.' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('does not let someone other than the task owner request support', async () => {
    const taskQuery = createQuery([{ data: { owner_id: recipientId }, error: null }])
    createClient.mockResolvedValue({ from: vi.fn(() => taskQuery) })

    const result = await addSupportRequest({
      taskId,
      neededFromId: recipientId,
      description: 'Need assistance',
    })

    expect(result).toEqual({
      error: 'Hanya PIC task yang dapat mengajukan permintaan bantuan.',
    })
    expect(taskQuery.insert).not.toHaveBeenCalled()
  })

  it('lets only the requested recipient mark support as provided', async () => {
    getSessionUser.mockResolvedValue({
      id: recipientId,
      email: 'recipient@example.test',
      name: 'Recipient',
      role: 'Manager',
      roleLevel: 3,
      orgUnitId: 4,
      supervisorId: null,
    })
    const supportQuery = createQuery([
      {
        data: { id: supportId, task_id: taskId, needed_from_id: recipientId, status: 'diminta' },
        error: null,
      },
      { data: { id: supportId }, error: null },
    ])
    createClient.mockResolvedValue({ from: vi.fn(() => supportQuery) })

    const result = await markSupportProvided({ supportId })

    expect(result).toEqual({ data: { success: true } })
    expect(supportQuery.update).toHaveBeenCalledWith({ status: 'diberikan' })
    expect(supportQuery.eq).toHaveBeenCalledWith('status', 'diminta')
    expect(revalidatePath).toHaveBeenCalledWith(`/tasks/${taskId}`)
  })

  it('denies a support update by a different user', async () => {
    const supportQuery = createQuery([
      {
        data: { id: supportId, task_id: taskId, needed_from_id: recipientId, status: 'diminta' },
        error: null,
      },
    ])
    createClient.mockResolvedValue({ from: vi.fn(() => supportQuery) })

    const result = await markSupportProvided({ supportId })

    expect(result).toEqual({
      error: 'Hanya user yang dimintai bantuan yang dapat menandai support diberikan.',
    })
    expect(supportQuery.update).not.toHaveBeenCalled()
  })
})
