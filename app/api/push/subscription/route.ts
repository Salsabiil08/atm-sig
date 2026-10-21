import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Only browsers' public push gateways; prevents user-controlled server-side requests.
const allowedHosts = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
  'push.services.mozilla.com',
  'notify.windows.com',
]
function validEndpoint(input: unknown): input is string {
  if (typeof input !== 'string' || input.length > 2048) return false
  try {
    const u = new URL(input)
    const host = u.hostname.toLowerCase()
    return u.protocol === 'https:' && !u.username && !u.password &&
      (u.port === '' || u.port === '443') &&
      allowedHosts.some(h => host === h || host.endsWith('.' + h))
  } catch { return false }
}
function validKeys(keys: unknown): keys is { p256dh: string; auth: string } {
  if (!keys || typeof keys !== 'object') return false
  const values = keys as Record<string, unknown>
  return ['p256dh', 'auth'].every(k => typeof values[k] === 'string' &&
    /^[A-Za-z0-9_-]{16,512}$/.test(values[k] as string))
}
function validOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return Boolean(origin && new URL(origin).host === new URL(request.url).host &&
    new URL(origin).protocol === 'https:')
}
async function authenticatedUser() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('users').select('status').eq('id', user.id).single()
  return data?.status === 'aktif' ? user : null
}

export async function POST(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origin ditolak' }, { status: 403 })
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!validEndpoint(body?.endpoint) || !validKeys(body?.keys)) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }
  const db = createAdminClient()
  const { data, error } = await db.rpc('register_push_subscription' as never, {
    p_user_id: user.id, p_endpoint: body.endpoint,
    p_p256dh: body.keys.p256dh, p_auth_secret: body.keys.auth,
  } as never)
  if (error) return NextResponse.json({ error: 'Cannot save subscription' }, { status: 500 })
  if (data !== true) return NextResponse.json({ error: 'Subscription unavailable' }, { status: 403 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  if (!validOrigin(request)) return NextResponse.json({ error: 'Origin ditolak' }, { status: 403 })
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!validEndpoint(body?.endpoint)) return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  const db = createAdminClient()
  const { error } = await db.from('push_subscriptions' as never).delete()
    .eq('user_id', user.id).eq('endpoint', body.endpoint)
  if (error) return NextResponse.json({ error: 'Cannot remove subscription' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
