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

import { respondToReminder } from './actions'

const reminderId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const taskId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const otherUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function createQuery(results: unknown[] = []) {
  let nextResult = 0
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    update: vi.fn(() => query),
    maybeSingle: vi.fn(async () => results[nextResult++]),
  }
  return query
}

describe('respondToReminder (FR-054, BR-034)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionUser.mockResolvedValue({ id: ownerId })
  })

  it('stores a valid PIC response once and refreshes task and notification views', async () => {
    const reminderQuery = createQuery([
      { data: { id: reminderId, task_id: taskId, response: null }, error: null },
      { data: { id: reminderId }, error: null },
    ])
    const taskQuery = createQuery([{ data: { id: taskId, owner_id: ownerId }, error: null }])
    createClient.mockResolvedValue({
      from: vi.fn((table: string) => table === 'tasks' ? taskQuery : reminderQuery),
    })

    const result = await respondToReminder({
      reminderId,
      response: 'Butuh support',
    })

    expect(result).toEqual({ data: { success: true } })
    expect(reminderQuery.update).toHaveBeenCalledWith({ response: 'Butuh support' })
    expect(reminderQuery.is).toHaveBeenCalledWith('response', null)
    expect(revalidatePath).toHaveBeenCalledWith('/notifications')
    expect(revalidatePath).toHaveBeenCalledWith(`/tasks/${taskId}`)
  })

  it('rejects invalid choices before reading the database', async () => {
    const result = await respondToReminder({
      reminderId,
      response: 'Kirim nanti',
    })

    expect(result).toEqual({ error: 'Pilih tanggapan reminder yang tersedia.' })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('does not allow another task participant to respond for the PIC', async () => {
    const reminderQuery = createQuery([
      { data: { id: reminderId, task_id: taskId, response: null }, error: null },
    ])
    const taskQuery = createQuery([{ data: { id: taskId, owner_id: otherUserId }, error: null }])
    createClient.mockResolvedValue({
      from: vi.fn((table: string) => table === 'tasks' ? taskQuery : reminderQuery),
    })

    const result = await respondToReminder({
      reminderId,
      response: 'Masih on progress',
    })

    expect(result).toEqual({ error: 'Hanya PIC task yang dapat menanggapi reminder.' })
    expect(reminderQuery.update).not.toHaveBeenCalled()
  })

  it('does not overwrite a response or a concurrent response', async () => {
    const alreadyAnswered = createQuery([
      { data: { id: reminderId, task_id: taskId, response: 'Masih on progress' }, error: null },
    ])
    createClient.mockResolvedValue({ from: vi.fn(() => alreadyAnswered) })

    await expect(respondToReminder({ reminderId, response: 'Butuh support' }))
      .resolves.toEqual({ error: 'Reminder ini sudah ditanggapi.' })
    expect(alreadyAnswered.update).not.toHaveBeenCalled()

    const raceQuery = createQuery([
      { data: { id: reminderId, task_id: taskId, response: null }, error: null },
      { data: { id: taskId, owner_id: ownerId }, error: null },
      { data: null, error: null },
    ])
    createClient.mockResolvedValue({ from: vi.fn(() => raceQuery) })
    await expect(respondToReminder({ reminderId, response: 'Butuh support' }))
      .resolves.toEqual({ error: 'Reminder ini sudah ditanggapi.' })
  })
})
