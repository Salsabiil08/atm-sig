import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateSession } from './middleware'

const { getUser, signOut, from, profileResult, roleResult } = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  profileResult: { data: { status: 'aktif', role_id: 6 }, error: null } as {
    data: { status: string; role_id: number } | null
    error: { message: string } | null
  },
  roleResult: { data: { level: 6 }, error: null } as {
    data: { level: number } | null
    error: { message: string } | null
  },
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser, signOut },
    from,
  }),
}))

describe('updateSession (FR-001)', () => {
  beforeEach(() => {
    getUser.mockReset()
    signOut.mockReset().mockResolvedValue({ error: null })
    profileResult.data = { status: 'aktif', role_id: 6 }
    profileResult.error = null
    roleResult.data = { level: 6 }
    roleResult.error = null
    from.mockReset().mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve(table === 'users' ? profileResult : roleResult),
        }),
      }),
    }))
  })

  it('redirects unauthenticated protected requests to login', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const response = await updateSession(
      new NextRequest('https://atm.example/tasks'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://atm.example/login')
  })

  it('redirects an authenticated user away from the login page', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-id' } } })

    const response = await updateSession(
      new NextRequest('https://atm.example/login'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://atm.example/dashboard')
  })

  it('signs out and redirects an inactive user', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-id' } } })
    profileResult.data = { status: 'nonaktif', role_id: 6 }

    const response = await updateSession(
      new NextRequest('https://atm.example/tasks'),
    )

    expect(signOut).toHaveBeenCalledOnce()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://atm.example/login?error=account_inactive',
    )
  })

  it('fails closed when the account status cannot be verified', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-id' } } })
    profileResult.data = null
    profileResult.error = { message: 'profile lookup failed' }

    const response = await updateSession(
      new NextRequest('https://atm.example/tasks'),
    )

    expect(signOut).toHaveBeenCalledOnce()
    expect(response.headers.get('location')).toBe(
      'https://atm.example/login?error=account_unavailable',
    )
  })

  it('redirects roles below Manager away from the dashboard', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-id' } } })
    roleResult.data = { level: 2 }

    const response = await updateSession(
      new NextRequest('https://atm.example/dashboard'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://atm.example/tasks?error=forbidden',
    )
  })

  it('redirects roles below Manager away from performance analytics', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-id' } } })
    roleResult.data = { level: 2 }

    const response = await updateSession(
      new NextRequest('https://atm.example/performance'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://atm.example/tasks?error=forbidden',
    )
  })

  it('redirects roles below SM away from user management', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-id' } } })
    roleResult.data = { level: 3 }

    const response = await updateSession(
      new NextRequest('https://atm.example/users'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://atm.example/tasks?error=forbidden',
    )
  })

  it('fails closed when the profile role cannot be verified', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-id' } } })
    roleResult.data = null
    roleResult.error = { message: 'role lookup failed' }

    const response = await updateSession(
      new NextRequest('https://atm.example/tasks'),
    )

    expect(signOut).toHaveBeenCalledOnce()
    expect(response.headers.get('location')).toBe(
      'https://atm.example/login?error=account_unavailable',
    )
  })

  it('does not treat other paths beginning with login as public', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const response = await updateSession(
      new NextRequest('https://atm.example/login-private'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://atm.example/login')
  })

  it.each(['/signup', '/forgot-password', '/reset-password', '/auth/confirm'])(
    'allows unauthenticated access to %s',
    async (path) => {
      getUser.mockResolvedValue({ data: { user: null } })

      const response = await updateSession(new NextRequest(`https://atm.example${path}`))

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
    },
  )
})
