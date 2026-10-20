// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ForgotPasswordForm from './ForgotPasswordForm'

const { resetPasswordForEmail } = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { resetPasswordForEmail } }),
}))

describe('ForgotPasswordForm (FR-001b)', () => {
  afterEach(cleanup)

  beforeEach(() => {
    resetPasswordForEmail.mockReset()
    resetPasswordForEmail.mockResolvedValue({ error: null })
  })

  it('sends a generic recovery request with the app callback', async () => {
    render(<ForgotPasswordForm />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Kirim tautan reset' }))

    expect((await screen.findByRole('status')).textContent).toContain('Jika email tersebut terdaftar')
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: expect.stringContaining('/auth/confirm?next=reset-password') },
    )
  })
})
