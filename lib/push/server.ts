import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

type ClaimedDelivery = {
  notification_id: string
  subscription_id: string
  claim_token: string
  endpoint: string
  p256dh: string
  auth_secret: string
}

export async function deliverPendingPush(limit = 50) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) throw new Error('VAPID belum dikonfigurasi')
  webpush.setVapidDetails(subject, publicKey, privateKey)

  const db = createAdminClient()
  const { data, error } = await db.rpc('claim_push_deliveries' as never, {
    p_batch_size: Math.min(Math.max(limit, 1), 100),
  } as never)
  if (error) throw error
  const claims = (data ?? []) as ClaimedDelivery[]
  let sent = 0
  let failed = 0
  let retired = 0

  for (const item of claims) {
    let success = false
    let terminal = false
    let reason: string | null = null
    try {
      // Generic lock-screen content deliberately does not expose sensitive task data.
      await webpush.sendNotification({
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth_secret },
      }, JSON.stringify({
        title: 'Accounting Task Manager',
        body: 'Ada notifikasi baru untuk Anda.',
        url: '/notifications',
        tag: item.notification_id,
      }), { TTL: 3600 })
      success = true
    } catch (cause) {
      const status = (cause as { statusCode?: number }).statusCode
      terminal = status === 404 || status === 410 || status === 400
      reason = status ? 'Push provider HTTP ' + status : 'Push provider delivery failure'
      failed++
    }
    // A claimed job can be finalized only with its lease token.
    const { data: recorded, error: finalizeError } = await db.rpc('finish_push_delivery' as never, {
      p_notification_id: item.notification_id,
      p_subscription_id: item.subscription_id,
      p_claim_token: item.claim_token,
      p_success: success,
      p_terminal: terminal,
      p_error: reason,
    } as never)
    if (finalizeError || recorded !== true) {
      console.error('Push delivery finalize failed', { notificationId: item.notification_id, error: finalizeError })
      failed++
      continue
    }
    if (success) sent++
    if (terminal) {
      // Stop attempts to push an endpoint rejected permanently by its provider.
      const { error: retireError } = await db.from('push_subscriptions' as never)
        .delete().eq('id', item.subscription_id)
      if (retireError) console.error('Push subscription cleanup failed', retireError)
      else retired++
    }
  }
  return { claimed: claims.length, sent, failed, retired }
}
