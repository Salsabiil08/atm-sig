// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PersonalUserManagement from './PersonalUserManagement'

const signInWithPassword = vi.fn()
const updateUser = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signInWithPassword, updateUser } }),
}))

const user = { name: 'Nata', email: 'nata@example.com', role: 'Staff/PIC', orgUnitName: 'Section Cost Accounting' }

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('PersonalUserManagement', () => {
  it('shows the current account and opens the password dialog', () => {
    render(<PersonalUserManagement user={user} />)
    expect(screen.getByText('Nata')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ubah Password' }))
    expect(screen.getByRole('dialog', { name: 'Ubah Password' })).toBeTruthy()
    expect(screen.getByLabelText('Password lama')).toBeTruthy()
  })

  it('rejects a mismatched new password before authentication', async () => {
    render(<PersonalUserManagement user={user} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ubah Password' }))
    fireEvent.change(screen.getByLabelText('Password lama'), { target: { value: 'password-lama' } })
    fireEvent.change(screen.getByLabelText('Password baru'), { target: { value: 'password-baru' } })
    fireEvent.change(screen.getByLabelText('Ketik lagi password baru'), { target: { value: 'berbeda-sekali' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Password' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Password baru tidak sama.')
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it('shows old-password and success feedback accurately', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: new Error('invalid credentials') })
    render(<PersonalUserManagement user={user} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ubah Password' }))
    for (const [label, value] of [['Password lama', 'salah-password'], ['Password baru', 'password-baru'], ['Ketik lagi password baru', 'password-baru']] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Password' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Password lama salah.')

    signInWithPassword.mockResolvedValueOnce({ error: null })
    updateUser.mockResolvedValueOnce({ error: null })
    for (const [label, value] of [['Password lama', 'password-lama'], ['Password baru', 'password-baru'], ['Ketik lagi password baru', 'password-baru']] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Password' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Password Berhasil Diubah'))
  })
})
