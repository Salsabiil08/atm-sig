import { createClient } from '@/lib/supabase/server'
import { isValidUuid } from '@/lib/tasks/validation'

export const NOTIFICATION_PAGE_SIZE = 50

export type NotificationItem = {
  id: string
  taskId: string | null
  reminderId: string | null
  type: string
  title: string
  body: string
  sentAt: string
  readAt: string | null
  reminderResponse: string | null
}

export type NotificationPage = {
  items: NotificationItem[]
  hasMore: boolean
}

export async function getNotifications(
  userId: string,
  offset = 0,
  unreadOnly = false,
): Promise<NotificationPage> {
  if (!isValidUuid(userId) || !Number.isInteger(offset) || offset < 0 || offset > 10_000) {
    throw new Error('Parameter notifikasi tidak valid.')
  }

  const supabase = await createClient()
  let query = supabase
    .from('notifications')
    .select('id, task_id, reminder_id, type, title, body, sent_at, read_at')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .range(offset, offset + NOTIFICATION_PAGE_SIZE)

  if (unreadOnly) query = query.is('read_at', null)

  const { data, error } = await query
  if (error) {
    console.error('[notifications] query failed', {
      name: error.name,
      code: error.code,
      message: error.message,
    })
    throw new Error('Gagal memuat notifikasi.')
  }
  if (!data) throw new Error('Data notifikasi tidak tersedia.')

  const page = data.slice(0, NOTIFICATION_PAGE_SIZE)
  const reminderIds = page.flatMap((item) => item.reminder_id ? [item.reminder_id] : [])
  const remindersById = new Map<string, string | null>()
  if (reminderIds.length > 0) {
    const { data: reminders, error: reminderError } = await supabase
      .from('task_reminders')
      .select('id, response')
      .in('id', reminderIds)
    if (reminderError) {
      console.error('[notifications] reminder query failed', {
        name: reminderError.name,
        code: reminderError.code,
        message: reminderError.message,
      })
      throw new Error('Gagal memuat status reminder.')
    }
    for (const reminder of reminders ?? []) {
      remindersById.set(reminder.id, reminder.response)
    }
  }

  return {
    items: page.map((item) => ({
      id: item.id,
      taskId: item.task_id,
      reminderId: item.reminder_id,
      type: item.type,
      title: item.title,
      body: item.body,
      sentAt: item.sent_at,
      readAt: item.read_at,
      reminderResponse: item.reminder_id ? remindersById.get(item.reminder_id) ?? null : null,
    })),
    hasMore: data.length > NOTIFICATION_PAGE_SIZE,
  }
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!isValidUuid(userId)) throw new Error('ID user tidak valid.')

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)

  if (error) {
    console.error('[notifications] unread count query failed', {
      name: error.name,
      code: error.code,
      message: error.message,
    })
    throw new Error('Gagal menghitung notifikasi yang belum dibaca.')
  }
  return count ?? 0
}
