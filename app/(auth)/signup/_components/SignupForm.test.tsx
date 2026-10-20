// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SignupForm from './SignupForm'

const { signUp, signOut } = vi.hoisted(() => ({
  signUp: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signUp, signOut } }),
}))

describe('SignupForm (FR-001a)', () => {
  afterEach(cleanup)

  beforeEach(() => {
    signUp.mockReset()
    signOut.mockReset()
  })

  it('registers a Spectator account and asks the user to confirm email', async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null })
    render(<SignupForm />)

    fireEvent.change(screen.getByLabelText('Nama'), { target: { value: 'Nama User' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Kata sandi'), { target: { value: 'password-123' } })
    fireEvent.change(screen.getByLabelText('Ulangi kata sandi'), { target: { value: 'password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Daftar' }))

    expect((await screen.findByRole('status')).textContent).toContain('konfirmasi')
    expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'user@example.com',
      password: 'password-123',
      options: expect.objectContaining({
        data: { name: 'Nama User' },
        emailRedirectTo: expect.stringContaining('/auth/confirm?next=email-confirmed'),
      }),
    }))
  })

  it('does not submit when password confirmation does not match', () => {
    render(<SignupForm />)

    fireEvent.change(screen.getByLabelText('Nama'), { target: { value: 'Nama User' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Kata sandi'), { target: { value: 'password-123' } })
    fireEvent.change(screen.getByLabelText('Ulangi kata sandi'), { target: { value: 'different-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Daftar' }))

    expect(screen.getByRole('alert').textContent).toContain('tidak sama')
    expect(signUp).not.toHaveBeenCalled()
  })
})
