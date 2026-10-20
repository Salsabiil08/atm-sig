import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

const { exchangeCodeForSession, verifyOtp } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession, verifyOtp },
  }),
}))

describe('GET /auth/confirm', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null })
    verifyOtp.mockReset().mockResolvedValue({ error: null })
  })

  it('verifies recovery tokens and returns to the reset form', async () => {
    const response = await GET(new NextRequest(
      'https://atm.example/auth/confirm?token_hash=token&type=recovery&next=reset-password',
    ))

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'token', type: 'recovery' })
    expect(response.headers.get('location')).toBe('https://atm.example/reset-password')
  })

  it('keeps the existing invite activation destination', async () => {
    const response = await GET(new NextRequest(
      'https://atm.example/auth/confirm?token_hash=token&type=invite',
    ))

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'token', type: 'invite' })
    expect(response.headers.get('location')).toBe('https://atm.example/accept-invite')
  })

  it('does not allow an external callback destination', async () => {
    const response = await GET(new NextRequest(
      'https://atm.example/auth/confirm?token_hash=token&type=signup&next=%2F%2Fevil.example',
    ))

    const location = new URL(response.headers.get('location')!)
    expect(location.origin).toBe('https://atm.example')
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('notice')).toBe('email_confirmed')
  })
})
