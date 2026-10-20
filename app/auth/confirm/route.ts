import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')
  const next = request.nextUrl.searchParams.get('next')
  const supabase = await createClient()

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type === 'invite'
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' })
      : tokenHash && type === 'recovery'
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        : tokenHash && type === 'signup'
          ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'signup' })
      : { error: new Error('Tautan undangan tidak valid.') }

  if (error) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', type === 'invite' ? 'invite_invalid' : 'auth_link_invalid')
    return NextResponse.redirect(loginUrl)
  }

  const destination = type === 'invite'
    ? '/accept-invite'
    : next === 'reset-password'
      ? '/reset-password'
      : '/login?notice=email_confirmed'

  return NextResponse.redirect(new URL(destination, request.url))
}
