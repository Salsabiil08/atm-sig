// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginForm from './LoginForm'

const { signInWithPassword, router } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  router: {
    replace: vi.fn(),
    refresh: vi.fn(),
  },
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signInWithPassword },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}))

function submitCredentials(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Kata Sandi'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Masuk' }))
}

describe('LoginForm (FR-001)', () => {
  afterEach(cleanup)

  beforeEach(() => {
    signInWithPassword.mockReset()
    router.replace.mockReset()
    router.refresh.mockReset()
  })

  it('redirects to the dashboard when Supabase accepts the credentials', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    render(<LoginForm />)

    submitCredentials('user@example.com', 'correct-password')

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/tasks')
    })
    expect(router.refresh).toHaveBeenCalledOnce()
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'correct-password',
    })
  })

  it('rejects invalid credentials and enables another attempt', async () => {
    signInWithPassword.mockResolvedValue({ error: new Error('Invalid login') })
    render(<LoginForm />)

    submitCredentials('user@example.com', 'wrong-password')

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Email atau kata sandi tidak valid. Silakan coba lagi.',
    )
    expect(router.replace).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Masuk' }).hasAttribute('disabled')).toBe(false)
    })
  })

  it('shows a connection error when the auth request throws', async () => {
    signInWithPassword.mockRejectedValue(new Error('Network unavailable'))
    render(<LoginForm />)

    submitCredentials('user@example.com', 'correct-password')

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Tidak dapat terhubung ke layanan login. Silakan coba lagi.',
    )
    expect(router.replace).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Masuk' }).hasAttribute('disabled')).toBe(false)
    })
  })
})
