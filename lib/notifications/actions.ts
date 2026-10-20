'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { isValidUuid } from '@/lib/tasks/validation'
import { getNotifications } from './queries'

export async function loadNotifications(offset: unknown, unreadOnly: unknown) {
  const user = await getSessionUser()
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0 || offset > 10_000) {
    return { error: 'Posisi notifikasi tidak valid.' }
  }
  if (typeof unreadOnly !== 'boolean') {
    return { error: 'Filter notifikasi tidak valid.' }
  }

  try {
    return { data: await getNotifications(user.id, offset, unreadOnly) }
  } catch (error) {
    if (error instanceof Error) return { error: error.message }
    throw error
  }
}

export async function markNotificationRead(notificationId: string) {
  const user = await getSessionUser()
  if (!isValidUuid(notificationId)) return { error: 'ID notifikasi tidak valid.' }

  const supabase = await createClient()
  const readAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: readAt })
    .eq('id', notificationId)
    .eq('user_id', user.id)
    .is('read_at', null)
    .select('id')
    .maybeSingle()

  if (error) return { error: 'Gagal menandai notifikasi sebagai dibaca.' }
  if (!data) {
    const { data: existing, error: readError } = await supabase
      .from('notifications')
      .select('id, read_at')
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (readError) return { error: 'Gagal memeriksa status notifikasi.' }
    if (!existing) return { error: 'Notifikasi tidak ditemukan.' }
    return { data: { success: true, readAt: existing.read_at ?? readAt } }
  }

  revalidatePath('/notifications')
  return { data: { success: true, readAt } }
}

export async function markAllNotificationsRead() {
  const user = await getSessionUser()
  const supabase = await createClient()
  const readAt = new Date().toISOString()
  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: readAt })
    .eq('user_id', user.id)
    .is('read_at', null)
    .select('id')

  if (error) return { error: 'Gagal menandai semua notifikasi sebagai dibaca.' }
  revalidatePath('/notifications')
  return { data: { success: true, count: data?.length ?? 0, readAt } }
}
