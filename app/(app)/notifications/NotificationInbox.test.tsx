// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { router, loadNotifications, markAllNotificationsRead, markNotificationRead, respondToReminder } =
  vi.hoisted(() => ({
    router: { push: vi.fn() },
    loadNotifications: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    markNotificationRead: vi.fn(),
    respondToReminder: vi.fn(),
  }))

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/lib/notifications/actions', () => ({
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
}))
vi.mock('@/lib/tasks/actions', () => ({ respondToReminder }))

import NotificationInbox from './NotificationInbox'
import type { NotificationItem } from '@/lib/notifications/queries'

const notifications: NotificationItem[] = [
  {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    taskId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    reminderId: null,
    type: 'task_progress_updated',
    title: 'Progress diperbarui: Jurnal',
    body: 'PIC memperbarui progress menjadi 20%.',
    sentAt: '2026-10-20T00:00:00.000Z',
    readAt: null,
    reminderResponse: null,
  },
  {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    taskId: null,
    reminderId: null,
    type: 'deadline_change_requested',
    title: 'Pengajuan perubahan tenggat',
    body: 'PIC mengajukan perubahan tenggat.',
    sentAt: '2026-10-19T00:00:00.000Z',
    readAt: '2026-10-19T01:00:00.000Z',
    reminderResponse: null,
  },
]

describe('NotificationInbox (FR-080)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    markNotificationRead.mockResolvedValue({
      data: { success: true, readAt: '2026-10-20T01:00:00.000Z' },
    })
    markAllNotificationsRead.mockResolvedValue({
      data: { success: true, count: 1, readAt: '2026-10-20T01:00:00.000Z' },
    })
    loadNotifications.mockResolvedValue({ data: { items: notifications, hasMore: false } })
    respondToReminder.mockResolvedValue({ data: { success: true } })
  })

  afterEach(cleanup)

  it('renders read state, filters unread items, and marks them read', async () => {
    loadNotifications.mockResolvedValueOnce({
      data: { items: [notifications[0]], hasMore: false },
    })
    render(
      <NotificationInbox
        initialItems={notifications}
        initialHasMore={false}
        initialUnreadCount={1}
      />,
    )

    expect(screen.getByText('Progress diperbarui: Jurnal')).toBeTruthy()
    expect(screen.getByText('Pengajuan perubahan tenggat')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Belum dibaca (1)' }))

    await waitFor(() => expect(loadNotifications).toHaveBeenCalledWith(0, true))
    expect(screen.getByText('Progress diperbarui: Jurnal')).toBeTruthy()
    expect(screen.queryByText('Pengajuan perubahan tenggat')).toBeNull()

    await waitFor(() => expect(
      screen.getByRole('button', { name: /Tandai "Progress diperbarui: Jurnal" sudah dibaca/ })
        .getAttribute('disabled'),
    ).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Tandai "Progress diperbarui: Jurnal" sudah dibaca/ }))
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith(notifications[0].id))
    expect(await screen.findByText('Belum dibaca (0)')).toBeTruthy()
    expect(screen.queryByText('Progress diperbarui: Jurnal')).toBeNull()
  })

  it('marks all notifications read and displays the empty unread state', async () => {
    markAllNotificationsRead.mockResolvedValue({
      data: { success: true, count: 1, readAt: '2026-10-20T01:00:00.000Z' },
    })
    loadNotifications.mockResolvedValue({ data: { items: [], hasMore: false } })
    render(
      <NotificationInbox
        initialItems={notifications}
        initialHasMore={false}
        initialUnreadCount={1}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tandai semua dibaca' }))
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Belum dibaca (0)' }))
    expect(await screen.findByText('Tidak ada notifikasi yang belum dibaca.')).toBeTruthy()
  })

  it('lets a PIC respond to an unanswered reminder and opens the task', async () => {
    const reminder: NotificationItem = {
      ...notifications[0],
      reminderId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      type: 'reminder_80',
      title: 'Reminder 80% untuk task',
      reminderResponse: null,
    }
    render(
      <NotificationInbox initialItems={[reminder]} initialHasMore={false} initialUnreadCount={1} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Butuh support' }))
    await waitFor(() => {
      expect(respondToReminder).toHaveBeenCalledWith({
        reminderId: reminder.reminderId,
        response: 'Butuh support',
      })
    })
    expect(router.push).toHaveBeenCalledWith(`/tasks/${reminder.taskId}`)
    expect(await screen.findByText('Tanggapan Anda: Butuh support')).toBeTruthy()
  })

  it('shows server action errors accessibly', async () => {
    markNotificationRead.mockResolvedValue({ error: 'Tidak dapat memperbarui notifikasi.' })
    render(
      <NotificationInbox initialItems={notifications} initialHasMore={false} initialUnreadCount={1} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Tandai "Progress diperbarui: Jurnal" sudah dibaca/ }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Tidak dapat memperbarui notifikasi.')
  })
})
