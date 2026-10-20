import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSessionUser, createClient, getNotifications, revalidatePath } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  createClient: vi.fn(),
  getNotifications: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({ getSessionUser }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('./queries', () => ({ getNotifications }))
vi.mock('next/cache', () => ({ revalidatePath }))

import {
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './actions'

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const notificationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const readAt = '2026-10-20T00:00:00.000Z'

function createQuery(results: unknown[] = [], finalResult?: unknown) {
  let nextResult = 0
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    update: vi.fn(() => query),
    maybeSingle: vi.fn(async () => results[nextResult++]),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(finalResult).then(resolve, reject),
  }
  return query
}

describe('notification actions (FR-080)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionUser.mockResolvedValue({ id: userId })
  })

  it('loads a validated page for the current user', async () => {
    const page = { items: [], hasMore: false }
    getNotifications.mockResolvedValue(page)

    await expect(loadNotifications(0, true)).resolves.toEqual({ data: page })
    expect(getNotifications).toHaveBeenCalledWith(userId, 0, true)
    await expect(loadNotifications(-1, false))
      .resolves.toEqual({ error: 'Posisi notifikasi tidak valid.' })
    await expect(loadNotifications(0, 'yes'))
      .resolves.toEqual({ error: 'Filter notifikasi tidak valid.' })
  })

  it('marks only the current user notification as read', async () => {
    const query = createQuery([{ data: { id: notificationId }, error: null }])
    createClient.mockResolvedValue({ from: vi.fn(() => query) })

    await expect(markNotificationRead(notificationId)).resolves.toMatchObject({
      data: { success: true, readAt: expect.any(String) },
    })
    expect(query.update).toHaveBeenCalledWith({ read_at: expect.any(String) })
    expect(query.eq).toHaveBeenCalledWith('user_id', userId)
    expect(query.is).toHaveBeenCalledWith('read_at', null)
    expect(revalidatePath).toHaveBeenCalledWith('/notifications')
  })

  it('treats an already-read notification as idempotent and rejects unknown IDs', async () => {
    const alreadyRead = createQuery([
      { data: null, error: null },
      { data: { id: notificationId, read_at: readAt }, error: null },
    ])
    createClient.mockResolvedValue({ from: vi.fn(() => alreadyRead) })
    await expect(markNotificationRead(notificationId)).resolves.toEqual({
      data: { success: true, readAt },
    })

    const missing = createQuery([
      { data: null, error: null },
      { data: null, error: null },
    ])
    createClient.mockResolvedValue({ from: vi.fn(() => missing) })
    await expect(markNotificationRead(notificationId))
      .resolves.toEqual({ error: 'Notifikasi tidak ditemukan.' })
  })

  it('marks all of the current user unread notifications as read', async () => {
    const query = createQuery([], {
      data: [{ id: notificationId }],
      error: null,
    })
    createClient.mockResolvedValue({ from: vi.fn(() => query) })

    await expect(markAllNotificationsRead()).resolves.toMatchObject({
      data: { success: true, count: 1, readAt: expect.any(String) },
    })
    expect(query.eq).toHaveBeenCalledWith('user_id', userId)
    expect(query.is).toHaveBeenCalledWith('read_at', null)
  })
})
