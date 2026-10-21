
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// NFR-001 — Refresh session Supabase
export async function proxy(request: NextRequest) {
  // Machine-to-machine push delivery is authenticated in its route handler
  // with CRON_SECRET. Cookie-based session redirects would turn POST into
  // /login and prevent the queue from ever being processed.
  if (request.nextUrl.pathname === '/api/cron/push') {
    const { NextResponse } = await import('next/server')
    return NextResponse.next()
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
