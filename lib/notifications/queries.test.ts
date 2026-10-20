import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { getNotifications, getUnreadNotificationCount, NOTIFICATION_PAGE_SIZE } from './queries'

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const reminderId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const notificationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function createQuery(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return query
}

describe('notification queries (FR-080)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads only the signed-in user notifications and the linked reminder response', async () => {
    const notificationsQuery = createQuery({
      data: [{
        id: notificationId,
        user_id: userId,
        task_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        reminder_id: reminderId,
        type: 'reminder_80',
        title: 'Reminder 80% untuk task',
        body: 'Task melewati checkpoint.',
        sent_at: '2026-10-20T00:00:00.000Z',
        read_at: null,
      }],
      error: null,
    })
    const remindersQuery = createQuery({
      data: [{ id: reminderId, response: null }],
      error: null,
    })
    createClient.mockResolvedValue({
      from: vi.fn((table: string) => (
        table === 'notifications' ? notificationsQuery : remindersQuery
      )),
    })

    const result = await getNotifications(userId)

    expect(result).toEqual({
      items: [{
        id: notificationId,
        taskId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        reminderId,
        type: 'reminder_80',
        title: 'Reminder 80% untuk task',
        body: 'Task melewati checkpoint.',
        sentAt: '2026-10-20T00:00:00.000Z',
        readAt: null,
        reminderResponse: null,
      }],
      hasMore: false,
    })
    expect(notificationsQuery.eq).toHaveBeenCalledWith('user_id', userId)
    expect(notificationsQuery.range).toHaveBeenCalledWith(0, NOTIFICATION_PAGE_SIZE)
    expect(remindersQuery.in).toHaveBeenCalledWith('id', [reminderId])
  })

  it('filters unread notifications at the database and rejects invalid pagination', async () => {
    const query = createQuery({ data: [], error: null })
    createClient.mockResolvedValue({ from: vi.fn(() => query) })

    await expect(getNotifications(userId, 50, true)).resolves.toEqual({
      items: [],
      hasMore: false,
    })
    expect(query.is).toHaveBeenCalledWith('read_at', null)
    await expect(getNotifications(userId, -1)).rejects.toThrow('Parameter notifikasi tidak valid.')
    expect(createClient).toHaveBeenCalledOnce()
  })

  it('returns the unread count and surfaces query failures', async () => {
    const countQuery = createQuery({ count: 3, error: null })
    createClient.mockResolvedValue({ from: vi.fn(() => countQuery) })

    await expect(getUnreadNotificationCount(userId)).resolves.toBe(3)
    expect(countQuery.eq).toHaveBeenCalledWith('user_id', userId)
    expect(countQuery.is).toHaveBeenCalledWith('read_at', null)

    createClient.mockResolvedValue({
      from: vi.fn(() => createQuery({ count: null, error: new Error('database unavailable') })),
    })
    await expect(getUnreadNotificationCount(userId))
      .rejects.toThrow('Gagal menghitung notifikasi yang belum dibaca.')
  })
})
