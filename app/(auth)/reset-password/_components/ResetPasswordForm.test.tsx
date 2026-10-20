// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ResetPasswordForm from './ResetPasswordForm'

const { updateUser, signOut, router } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  signOut: vi.fn(),
  router: { replace: vi.fn(), refresh: vi.fn() },
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { updateUser, signOut } }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

describe('ResetPasswordForm (FR-001b)', () => {
  afterEach(cleanup)

  beforeEach(() => {
    updateUser.mockReset()
    signOut.mockReset()
    router.replace.mockReset()
    router.refresh.mockReset()
    updateUser.mockResolvedValue({ error: null })
    signOut.mockResolvedValue({ error: null })
  })

  it('updates the password only after confirmation and closes the recovery session', async () => {
    render(<ResetPasswordForm />)

    fireEvent.change(screen.getByLabelText('Kata sandi baru'), { target: { value: 'new-password-123' } })
    fireEvent.change(screen.getByLabelText('Ulangi kata sandi baru'), { target: { value: 'new-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan kata sandi baru' }))

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/login?notice=password_updated')
    })
    expect(updateUser).toHaveBeenCalledWith({ password: 'new-password-123' })
    expect(signOut).toHaveBeenCalledOnce()
    expect(router.refresh).toHaveBeenCalledOnce()
  })

  it('rejects mismatched confirmation without changing the password', () => {
    render(<ResetPasswordForm />)

    fireEvent.change(screen.getByLabelText('Kata sandi baru'), { target: { value: 'new-password-123' } })
    fireEvent.change(screen.getByLabelText('Ulangi kata sandi baru'), { target: { value: 'other-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan kata sandi baru' }))

    expect(screen.getByRole('alert').textContent).toContain('tidak sama')
    expect(updateUser).not.toHaveBeenCalled()
  })
})
