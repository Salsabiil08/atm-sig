import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function authenticatedUser() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data } = await admin.from('users').select('status').eq('id', user.id).single()
  return data?.status === 'aktif' ? user : null
}

export async function POST(request: Request) {
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const endpoint = body?.endpoint
  const keys = body?.keys
  if (typeof endpoint !== 'string' || endpoint.length > 2048 ||
      !endpoint.startsWith('https://') ||
      typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string' ||
      keys.p256dh.length > 512 || keys.auth.length > 512) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }
  const db = createAdminClient()
  const { data: existing } = await db.from('push_subscriptions' as never).select('user_id').eq('endpoint', endpoint).maybeSingle() as unknown as { data: { user_id: string } | null }
  if (existing && existing.user_id !== user.id) return NextResponse.json({ error: 'Endpoint belongs to another user' }, { status: 409 })
  const { error } = await db.from('push_subscriptions' as never).upsert({
    user_id: user.id, endpoint, p256dh: keys.p256dh, auth_secret: keys.auth,
    updated_at: new Date().toISOString(),
  } as never, { onConflict: 'endpoint' })
  if (error) return NextResponse.json({ error: 'Cannot save subscription' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
  const db = createAdminClient()
  const { error } = await db.from('push_subscriptions' as never).delete().eq('user_id', user.id).eq('endpoint', body.endpoint)
  if (error) return NextResponse.json({ error: 'Cannot remove subscription' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
