import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth_secret: string }

export async function deliverPendingPush(limit = 50) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) throw new Error('VAPID belum dikonfigurasi')
  webpush.setVapidDetails(subject, publicKey, privateKey)
  const db = createAdminClient()
  // Server-side admin access: subscription secrets never reach browser APIs.
  const { data: notices, error } = await db.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  let sent = 0, failed = 0
  for (const notice of notices ?? []) {
    const recipient = (notice as Record<string, unknown>).user_id
    if (typeof recipient !== 'string') continue
    const { data: subscriptions } = await db.from('push_subscriptions' as never).select('*').eq('user_id', recipient) as unknown as { data: SubscriptionRow[] | null }
    for (const sub of subscriptions ?? []) {
      const { data: prior } = await db.from('push_deliveries' as never).select('notification_id').eq('notification_id', notice.id).eq('subscription_id', sub.id).maybeSingle()
      if (prior) continue
      const payload = JSON.stringify({
        title: 'Accounting Task Manager',
        body: 'Ada notifikasi baru untuk Anda.',
        url: '/notifications',
        tag: notice.id,
      })
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_secret } }, payload, { TTL: 3600 })
        await db.from('push_deliveries' as never).insert({ notification_id: notice.id, subscription_id: sub.id } as never)
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await db.from('push_subscriptions' as never).delete().eq('id', sub.id)
        failed++
      }
    }
  }
  return { sent, failed }
}
