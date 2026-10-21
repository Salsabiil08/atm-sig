import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { deliverPendingPush } from '@/lib/push/server'

async function processPushCron(request: Request) {
  const secret = process.env.CRON_SECRET
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
  if (!secret || Buffer.byteLength(token) !== Buffer.byteLength(secret) ||
      !timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await deliverPendingPush())
  } catch (error) {
    console.error('Push delivery failed', error)
    return NextResponse.json({ error: 'Push delivery failed' }, { status: 500 })
  }
}

// Vercel Cron invokes GET; authenticated manual jobs may use POST.
export const GET = processPushCron
export const POST = processPushCron
