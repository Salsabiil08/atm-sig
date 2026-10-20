// NFR-001 — Supabase session refresh helper untuk middleware
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'

function requiredRoleLevel(pathname: string): number | null {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 3
  if (pathname === '/performance' || pathname.startsWith('/performance/')) return 3
  if (pathname === '/users' || pathname.startsWith('/users/')) return 4
  return null
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Jangan hapus pemanggilan getUser() — penting untuk menyegarkan session
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rute konfirmasi undangan harus dapat diakses sebelum sesi dibuat.
  const isPublicRoute = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/auth/confirm',
  ].includes(pathname)

  if (!user && !isPublicRoute) {
    // Belum login → redirect ke login
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    const response = NextResponse.redirect(loginUrl)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('status, role_id')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.status !== 'aktif') {
      await supabase.auth.signOut()
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      loginUrl.searchParams.set(
        'error',
        profileError ? 'account_unavailable' : 'account_inactive',
      )
      const response = NextResponse.redirect(loginUrl)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie)
      })
      return response
    }

    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('level')
      .eq('id', profile.role_id)
      .single()

    if (roleError || !role) {
      await supabase.auth.signOut()
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      loginUrl.searchParams.set('error', 'account_unavailable')
      const response = NextResponse.redirect(loginUrl)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie)
      })
      return response
    }

    const minimumRoleLevel = requiredRoleLevel(pathname)
    if (minimumRoleLevel !== null && role.level < minimumRoleLevel) {
      const fallbackUrl = request.nextUrl.clone()
      fallbackUrl.pathname = '/tasks'
      fallbackUrl.search = ''
      fallbackUrl.searchParams.set('error', 'forbidden')
      const response = NextResponse.redirect(fallbackUrl)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie)
      })
      return response
    }
  }

  if (user && pathname === '/login') {
    // Sudah login tapi membuka /login → redirect ke dashboard
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    const response = NextResponse.redirect(dashboardUrl)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  return supabaseResponse
}
