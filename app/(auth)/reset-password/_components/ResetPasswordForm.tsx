'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== confirmation) {
      setError('Konfirmasi kata sandi tidak sama.')
      return
    }

    setBusy(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('Tautan reset tidak valid atau kedaluwarsa. Minta tautan reset baru.')
        return
      }

      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        setError('Kata sandi sudah diperbarui, tetapi sesi pemulihan tidak dapat ditutup. Silakan keluar dari aplikasi sebelum masuk kembali.')
        return
      }

      router.replace('/login?notice=password_updated')
      router.refresh()
    } catch {
      setError('Kata sandi tidak dapat diperbarui. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div>
        <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">Kata sandi baru</label>
        <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900" disabled={busy} />
      </div>
      <div>
        <label htmlFor="new-password-confirm" className="mb-1.5 block text-sm font-medium text-slate-700">Ulangi kata sandi baru</label>
        <input id="new-password-confirm" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900" disabled={busy} />
      </div>
      <button type="submit" disabled={busy} className="min-h-11 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? 'Menyimpan...' : 'Simpan kata sandi baru'}
      </button>
    </form>
  )
}
